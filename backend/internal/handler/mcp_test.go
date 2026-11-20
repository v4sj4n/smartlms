package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"smartlms/backend/internal/db"
	"smartlms/backend/internal/util"
)

// mcpAPI opens a seeded database and returns the mux plus the demo users by role.
func mcpAPI(t *testing.T) (*http.ServeMux, map[string]string) {
	mux, users, _ := mcpAPIWithDB(t)
	return mux, users
}

func mcpAPIWithDB(t *testing.T) (*http.ServeMux, map[string]string, *sql.DB) {
	t.Helper()
	ctx := context.Background()
	database, err := db.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })
	if err := db.Migrate(ctx, database); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	if err := db.Seed(ctx, database); err != nil {
		t.Fatalf("seed: %v", err)
	}
	users := map[string]string{}
	rows, err := database.QueryContext(ctx, `SELECT u.id, r.name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.email LIKE '%@smartlms.dev'`)
	if err != nil {
		t.Fatalf("users: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		var id, role string
		if err := rows.Scan(&id, &role); err != nil {
			t.Fatal(err)
		}
		users[role] = id
	}
	mux := http.NewServeMux()
	registerMCP(mux, database)
	return mux, users, database
}

type mcpReply struct {
	Result json.RawMessage  `json:"result"`
	Error  *mcpJSONRPCError `json:"error"`
}

func mcpPost(t *testing.T, mux *http.ServeMux, userID, body string) (int, mcpReply) {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/mcp", strings.NewReader(body))
	if userID != "" {
		req.Header.Set("X-SmartLMS-User", userID)
	}
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	var reply mcpReply
	if rec.Code == http.StatusOK || rec.Code == http.StatusUnauthorized {
		_ = json.Unmarshal(rec.Body.Bytes(), &reply)
	}
	return rec.Code, reply
}

func listedTools(t *testing.T, mux *http.ServeMux, userID string) map[string]bool {
	t.Helper()
	_, reply := mcpPost(t, mux, userID, `{"jsonrpc":"2.0","id":1,"method":"tools/list"}`)
	var out struct {
		Tools []struct{ Name string } `json:"tools"`
	}
	if err := json.Unmarshal(reply.Result, &out); err != nil {
		t.Fatalf("tools/list: %v (%s)", err, reply.Result)
	}
	names := map[string]bool{}
	for _, tool := range out.Tools {
		names[tool.Name] = true
	}
	return names
}

func callTool(t *testing.T, mux *http.ServeMux, userID, name, args string) (isError bool, text string) {
	t.Helper()
	body := `{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"` + name + `","arguments":` + args + `}}`
	_, reply := mcpPost(t, mux, userID, body)
	var out struct {
		IsError bool                    `json:"isError"`
		Content []struct{ Text string } `json:"content"`
	}
	if err := json.Unmarshal(reply.Result, &out); err != nil {
		t.Fatalf("tools/call: %v (%s)", err, reply.Result)
	}
	if len(out.Content) > 0 {
		text = out.Content[0].Text
	}
	return out.IsError, text
}

func TestMCPRejectsMissingAndUnknownCallers(t *testing.T) {
	mux, _ := mcpAPI(t)
	if code, _ := mcpPost(t, mux, "", `{"jsonrpc":"2.0","id":1,"method":"ping"}`); code != http.StatusBadRequest {
		t.Fatalf("no caller: status %d, want 400", code)
	}
	if code, _ := mcpPost(t, mux, "nobody", `{"jsonrpc":"2.0","id":1,"method":"ping"}`); code != http.StatusUnauthorized {
		t.Fatalf("unknown caller: status %d, want 401", code)
	}
}

func TestMCPToolsListFollowsPermissions(t *testing.T) {
	mux, users := mcpAPI(t)

	student := listedTools(t, mux, users["STUDENT"])
	if student["create_subject"] || student["create_quiz"] || student["create_forum_thread"] {
		t.Fatalf("student sees management tools: %v", student)
	}
	if !student["post_forum_reply"] {
		t.Fatalf("student should see post_forum_reply: %v", student)
	}

	lecturer := listedTools(t, mux, users["LECTURER"])
	for _, name := range []string{"create_subject", "create_quiz", "create_forum_thread", "post_forum_reply"} {
		if !lecturer[name] {
			t.Fatalf("lecturer missing %s: %v", name, lecturer)
		}
	}
}

func TestMCPToolsCallEnforcesPermission(t *testing.T) {
	mux, users := mcpAPI(t)

	// Hidden from the list is not enough: calling by name must be refused too.
	isError, text := callTool(t, mux, users["STUDENT"], "create_subject", `{"name":"Hacked","code":"HX1"}`)
	if !isError || !strings.Contains(text, "subjects.manage") {
		t.Fatalf("student create_subject: isError=%v text=%q", isError, text)
	}

	isError, text = callTool(t, mux, users["ADMIN"], "list_subjects", `{}`)
	if isError {
		t.Fatalf("admin list_subjects failed: %s", text)
	}
}

func TestMCPNotificationGetsNoBody(t *testing.T) {
	mux, users := mcpAPI(t)
	code, _ := mcpPost(t, mux, users["ADMIN"], `{"jsonrpc":"2.0","method":"notifications/initialized"}`)
	if code != http.StatusAccepted {
		t.Fatalf("notification: status %d, want 202", code)
	}
}

// scopedFixture adds two subjects: "mine" taught by the lecturer with the
// student enrolled, and "theirs" taught by the admin with nobody enrolled.
func scopedFixture(t *testing.T, database *sql.DB, users map[string]string) (mine, theirs, assignment string) {
	t.Helper()
	ctx := context.Background()
	now := util.Now()
	mine, theirs, assignment = util.NewID(), util.NewID(), util.NewID()
	exec := func(query string, args ...any) {
		if _, err := database.ExecContext(ctx, query, args...); err != nil {
			t.Fatalf("%s: %v", query, err)
		}
	}
	for id, lecturer := range map[string]string{mine: users["LECTURER"], theirs: users["ADMIN"]} {
		exec(`INSERT INTO subjects (id, name, lecturer_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
			id, "Subject "+id[:6], lecturer, now, now)
	}
	exec(`INSERT INTO enrollments (id, student_id, subject_id, enrolled_at) VALUES (?, ?, ?, ?)`,
		util.NewID(), users["STUDENT"], mine, now)
	exec(`INSERT INTO assignments (id, subject_id, title, submission_type, created_at, updated_at)
		VALUES (?, ?, 'Essay', 'text', ?, ?)`, assignment, mine, now, now)
	return mine, theirs, assignment
}

func TestMCPEachRoleGetsItsOwnToolset(t *testing.T) {
	mux, users := mcpAPI(t)
	student := listedTools(t, mux, users["STUDENT"])
	lecturer := listedTools(t, mux, users["LECTURER"])
	admin := listedTools(t, mux, users["ADMIN"])

	for _, name := range []string{"list_my_courses", "list_my_assignments", "submit_assignment", "my_grades",
		"list_quizzes", "study_flashcards", "list_forum_threads", "read_forum_thread", "post_forum_reply"} {
		if !student[name] {
			t.Errorf("student missing %s", name)
		}
	}
	for _, name := range []string{"grade_submission", "create_lecture", "list_users", "set_active_school_year"} {
		if student[name] {
			t.Errorf("student should not see %s", name)
		}
	}
	for _, name := range []string{"grade_submission", "list_submissions", "create_lecture"} {
		if !lecturer[name] {
			t.Errorf("lecturer missing %s", name)
		}
	}
	for _, name := range []string{"list_users", "set_active_school_year", "submit_assignment"} {
		if lecturer[name] {
			t.Errorf("lecturer should not see %s", name)
		}
	}
	for _, name := range []string{"list_users", "list_school_years", "set_active_school_year", "grade_submission"} {
		if !admin[name] {
			t.Errorf("admin missing %s", name)
		}
	}
}

func TestMCPRowsAreScopedToTheCaller(t *testing.T) {
	mux, users, database := mcpAPIWithDB(t)
	mine, theirs, assignment := scopedFixture(t, database, users)

	// Lecturer: authors on their own subject, refused on someone else's.
	if isError, text := callTool(t, mux, users["LECTURER"], "create_lecture",
		`{"subject_id":"`+mine+`","title":"Intro"}`); isError {
		t.Fatalf("lecturer on own subject: %s", text)
	}
	if isError, _ := callTool(t, mux, users["LECTURER"], "create_lecture",
		`{"subject_id":"`+theirs+`","title":"Hijack"}`); !isError {
		t.Fatal("lecturer created a lecture in another lecturer's subject")
	}

	// Student: reads enrolled subjects only, submits own work.
	if isError, text := callTool(t, mux, users["STUDENT"], "study_flashcards", `{"subject_id":"`+mine+`"}`); isError {
		t.Fatalf("student on enrolled subject: %s", text)
	}
	if isError, _ := callTool(t, mux, users["STUDENT"], "study_flashcards", `{"subject_id":"`+theirs+`"}`); !isError {
		t.Fatal("student read a subject they are not enrolled in")
	}
	if isError, text := callTool(t, mux, users["STUDENT"], "submit_assignment",
		`{"assignment_id":"`+assignment+`","content":"My essay"}`); isError {
		t.Fatalf("student submit: %s", text)
	}

	// The lecturer grades it; the admin can too; the student cannot.
	var submissionID string
	if err := database.QueryRow(`SELECT id FROM assignment_submissions WHERE assignment_id = ?`, assignment).
		Scan(&submissionID); err != nil {
		t.Fatal(err)
	}
	if isError, _ := callTool(t, mux, users["STUDENT"], "grade_submission",
		`{"submission_id":"`+submissionID+`","score":100}`); !isError {
		t.Fatal("student graded their own submission")
	}
	if isError, text := callTool(t, mux, users["LECTURER"], "grade_submission",
		`{"submission_id":"`+submissionID+`","score":88,"feedback":"Good"}`); isError {
		t.Fatalf("lecturer grade: %s", text)
	}

	// list_my_courses differs per role.
	courses := func(user string) string {
		_, text := callTool(t, mux, user, "list_my_courses", `{}`)
		return text
	}
	if c := courses(users["STUDENT"]); !strings.Contains(c, mine) || strings.Contains(c, theirs) {
		t.Fatalf("student courses wrong: %s", c)
	}
	if c := courses(users["LECTURER"]); !strings.Contains(c, mine) || strings.Contains(c, theirs) {
		t.Fatalf("lecturer courses wrong: %s", c)
	}
	if c := courses(users["ADMIN"]); !strings.Contains(c, mine) || !strings.Contains(c, theirs) {
		t.Fatalf("admin courses wrong: %s", c)
	}
}
