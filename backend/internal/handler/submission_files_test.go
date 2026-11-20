package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
	"time"

	"optimolms/backend/internal/util"
)

// submissionFixture is one subject with one assignment and the seeded student
// enrolled in it, so an upload has somewhere to land.
type submissionFixture struct {
	api          *authAPI
	subjectID    string
	assignmentID string
	studentID    string
	lecturerID   string
	adminID      string
}

func newSubmissionFixture(t *testing.T, submissionType, dueAt string, allowLate bool) submissionFixture {
	t.Helper()
	api := newAuthAPI(t)
	ctx := context.Background()
	now := util.Now()

	subjectID := util.NewID()
	if _, err := api.db.ExecContext(ctx, `
		INSERT INTO subjects (id, name, code, description, lecturer_id, created_at, updated_at)
		VALUES (?, 'Optics', ?, 'Lenses and light.', ?, ?, ?)`,
		subjectID, "OPT-"+subjectID[:8], api.users["LECTURER"], now, now); err != nil {
		t.Fatalf("insert subject: %v", err)
	}

	allowLateFlag := 0
	if allowLate {
		allowLateFlag = 1
	}
	var due any
	if dueAt != "" {
		due = dueAt
	}
	assignmentID := util.NewID()
	if _, err := api.db.ExecContext(ctx, `
		INSERT INTO assignments (id, subject_id, title, description, due_at, max_points, allow_late,
		                         submission_type, is_published, created_at, updated_at)
		VALUES (?, ?, 'Optics worksheet', 'Hand it in.', ?, 100, ?, ?, 1, ?, ?)`,
		assignmentID, subjectID, due, allowLateFlag, submissionType, now, now); err != nil {
		t.Fatalf("insert assignment: %v", err)
	}

	if _, err := api.db.ExecContext(ctx,
		`INSERT INTO enrollments (id, student_id, subject_id, enrolled_at) VALUES (?, ?, ?, ?)`,
		util.NewID(), api.users["STUDENT"], subjectID, now); err != nil {
		t.Fatalf("enroll student: %v", err)
	}

	return submissionFixture{
		api: api, subjectID: subjectID, assignmentID: assignmentID,
		studentID: api.users["STUDENT"], lecturerID: api.users["LECTURER"], adminID: api.users["ADMIN"],
	}
}

// addStudent creates another account with the seeded student's role and password
// and, when asked, enrolls it in the fixture's subject.
func (f submissionFixture) addStudent(t *testing.T, email string, enrolled bool) string {
	t.Helper()
	now := util.Now()
	id := util.NewID()
	if _, err := f.api.db.ExecContext(context.Background(), `
		INSERT INTO users (id, email, password_hash, name, role_id, created_at, updated_at)
		SELECT ?, ?, password_hash, ?, role_id, ?, ? FROM users WHERE id = ?`,
		id, email, "Extra Student", now, now, f.studentID); err != nil {
		t.Fatalf("insert student: %v", err)
	}
	if enrolled {
		if _, err := f.api.db.ExecContext(context.Background(),
			`INSERT INTO enrollments (id, student_id, subject_id, enrolled_at) VALUES (?, ?, ?, ?)`,
			util.NewID(), id, f.subjectID, now); err != nil {
			t.Fatalf("enroll extra student: %v", err)
		}
	}
	return id
}

// signInAs logs in any account, not just the three seeded roles.
func (api *authAPI) signInAs(email, password string) *http.Cookie {
	api.t.Helper()
	recorder := api.post(http.MethodPost, "/api/auth/login", map[string]string{
		"email": email, "password": password,
	}, nil)
	if recorder.Code != http.StatusOK {
		api.t.Fatalf("login %s: status %d body %s", email, recorder.Code, recorder.Body.String())
	}
	return sessionCookie(api.t, recorder)
}

// putSubmissionFile is one multipart upload against the submission file route.
func (api *authAPI) putSubmissionFile(cookie *http.Cookie, assignmentID, name string, data []byte) *httptest.ResponseRecorder {
	api.t.Helper()
	var body bytes.Buffer
	form := multipart.NewWriter(&body)
	part, err := form.CreateFormFile("file", name)
	if err != nil {
		api.t.Fatalf("form field: %v", err)
	}
	if _, err := part.Write(data); err != nil {
		api.t.Fatalf("form bytes: %v", err)
	}
	if err := form.Close(); err != nil {
		api.t.Fatalf("close form: %v", err)
	}
	request := httptest.NewRequest(http.MethodPut,
		"/api/assignments/"+assignmentID+"/submission/file", &body)
	request.Header.Set("Content-Type", form.FormDataContentType())
	request.AddCookie(cookie)
	recorder := httptest.NewRecorder()
	api.app.ServeHTTP(recorder, request)
	return recorder
}

func (f submissionFixture) uploadAs(t *testing.T, role, name string, data []byte) *httptest.ResponseRecorder {
	t.Helper()
	cookie, _ := f.api.signIn(role)
	return f.api.putSubmissionFile(cookie, f.assignmentID, name, data)
}

func (f submissionFixture) readSettings(t *testing.T, role string) generalSettings {
	t.Helper()
	recorder := f.api.asRole(role, http.MethodGet, "/api/settings/general", nil)
	if recorder.Code != http.StatusOK {
		t.Fatalf("get settings: status %d body %s", recorder.Code, recorder.Body.String())
	}
	var out generalSettings
	if err := json.NewDecoder(recorder.Body).Decode(&out); err != nil {
		t.Fatalf("decode settings: %v", err)
	}
	return out
}

// The two submission limits are settings, not constants: everybody reads them,
// only the holder of settings.manage writes them.
func TestGeneralSettingsDefaultsAndValidation(t *testing.T) {
	fixture := newSubmissionFixture(t, "both", "", true)

	defaults := fixture.readSettings(t, "STUDENT")
	if defaults.SubmissionMaxFileMB != defaultSubmissionMaxFileMB {
		t.Errorf("default max_file_mb = %d, want %d", defaults.SubmissionMaxFileMB, defaultSubmissionMaxFileMB)
	}
	if len(defaults.SubmissionAllowedFileTypes) != len(defaultSubmissionFileTypes) {
		t.Fatalf("default types = %v, want %v", defaults.SubmissionAllowedFileTypes, defaultSubmissionFileTypes)
	}
	for _, ext := range []string{"pdf", "docx", "pptx", "xlsx", "zip", "png", "jpg", "jpeg", "txt", "md"} {
		if !slices.Contains(defaults.SubmissionAllowedFileTypes, ext) {
			t.Errorf("default allow-list is missing %s: %v", ext, defaults.SubmissionAllowedFileTypes)
		}
	}

	// Reading is open to a student; writing is not, and a lecturer is not an
	// administrator either — settings.manage is what decides.
	for _, role := range []string{"STUDENT", "LECTURER"} {
		recorder := fixture.api.asRole(role, http.MethodPut, "/api/settings/general",
			map[string]any{"submission_max_file_mb": 10})
		if recorder.Code != http.StatusForbidden {
			t.Errorf("%s write: status %d, want 403", role, recorder.Code)
		}
	}

	for _, rejected := range []struct {
		what string
		body map[string]any
	}{
		{"extension with a space", map[string]any{"submission_allowed_file_types": []string{"p df"}}},
		{"extension with a slash", map[string]any{"submission_allowed_file_types": []string{"../pdf"}}},
		{"empty extension", map[string]any{"submission_allowed_file_types": []string{"pdf", "."}}},
		{"empty allow-list", map[string]any{"submission_allowed_file_types": []string{}}},
		{"size too small", map[string]any{"submission_max_file_mb": 0}},
		{"size too large", map[string]any{"submission_max_file_mb": 2049}},
		{"nothing to update", map[string]any{}},
	} {
		recorder := fixture.api.asRole("ADMIN", http.MethodPut, "/api/settings/general", rejected.body)
		if recorder.Code != http.StatusBadRequest {
			t.Errorf("%s: status %d, want 400 (body %s)", rejected.what, recorder.Code, recorder.Body.String())
		}
	}

	// A real write cleans the list: leading dots go, case folds, duplicates
	// collapse.
	recorder := fixture.api.asRole("ADMIN", http.MethodPut, "/api/settings/general", map[string]any{
		"submission_allowed_file_types": []string{".PDF", "Docx", "pdf", "zip"},
		"submission_max_file_mb":        10,
	})
	if recorder.Code != http.StatusOK {
		t.Fatalf("admin write: status %d body %s", recorder.Code, recorder.Body.String())
	}
	var written generalSettings
	if err := json.NewDecoder(recorder.Body).Decode(&written); err != nil {
		t.Fatalf("decode write: %v", err)
	}
	if want := []string{"pdf", "docx", "zip"}; !slices.Equal(written.SubmissionAllowedFileTypes, want) {
		t.Errorf("cleaned types = %v, want %v", written.SubmissionAllowedFileTypes, want)
	}
	if written.SubmissionMaxFileMB != 10 {
		t.Errorf("max_file_mb = %d, want 10", written.SubmissionMaxFileMB)
	}

	// A partial write keeps the other field's stored value, and the student sees
	// the change on their next read.
	partial := fixture.api.asRole("ADMIN", http.MethodPut, "/api/settings/general",
		map[string]any{"submission_max_file_mb": 40})
	if partial.Code != http.StatusOK {
		t.Fatalf("partial write: status %d body %s", partial.Code, partial.Body.String())
	}
	after := fixture.readSettings(t, "STUDENT")
	if after.SubmissionMaxFileMB != 40 {
		t.Errorf("max_file_mb after partial write = %d, want 40", after.SubmissionMaxFileMB)
	}
	if want := []string{"pdf", "docx", "zip"}; !slices.Equal(after.SubmissionAllowedFileTypes, want) {
		t.Errorf("types after partial write = %v, want %v", after.SubmissionAllowedFileTypes, want)
	}
}

// A student hands a file in, replaces it, downloads it, and takes it back —
// the submission row survives the delete, only the file goes.
func TestSubmissionFileLifecycle(t *testing.T) {
	fixture := newSubmissionFixture(t, "both", "", true)

	first := []byte("%PDF-1.7\noptics worksheet")
	uploaded := fixture.uploadAs(t, "STUDENT", "worksheet.pdf", first)
	if uploaded.Code != http.StatusCreated {
		t.Fatalf("upload: status %d body %s", uploaded.Code, uploaded.Body.String())
	}
	var submission submissionOut
	if err := json.NewDecoder(uploaded.Body).Decode(&submission); err != nil {
		t.Fatalf("decode submission: %v", err)
	}
	if submission.FileName == nil || *submission.FileName != "worksheet.pdf" {
		t.Errorf("file_name = %v, want worksheet.pdf", submission.FileName)
	}
	if submission.FileKind == nil || *submission.FileKind != "pdf" {
		t.Errorf("file_kind = %v, want pdf", submission.FileKind)
	}
	if submission.FileSize == nil || *submission.FileSize != int64(len(first)) {
		t.Errorf("file_size = %v, want %d", submission.FileSize, len(first))
	}
	if submission.Status != "submitted" {
		t.Errorf("status = %q, want submitted", submission.Status)
	}
	if submission.FileURL != "" {
		t.Errorf("file_url = %q, want empty: the share link is untouched", submission.FileURL)
	}
	submissionID := submission.ID

	// The student's own view of the assignment carries the summary too.
	detail := fixture.api.asRole("STUDENT", http.MethodGet, "/api/assignments/"+fixture.assignmentID, nil)
	var payload struct {
		Submission *submissionOut `json:"submission"`
	}
	if err := json.NewDecoder(detail.Body).Decode(&payload); err != nil {
		t.Fatalf("decode detail: %v", err)
	}
	if payload.Submission == nil || payload.Submission.FileName == nil || *payload.Submission.FileName != "worksheet.pdf" {
		t.Fatalf("assignment detail should show the file, got %+v", payload.Submission)
	}

	// The lecturer's grading queue carries it as well.
	queue := fixture.api.asRole("LECTURER", http.MethodGet,
		"/api/assignments/"+fixture.assignmentID+"/submissions", nil)
	var listed []submissionOut
	if err := json.NewDecoder(queue.Body).Decode(&listed); err != nil {
		t.Fatalf("decode queue: %v", err)
	}
	if len(listed) != 1 || listed[0].FileName == nil || *listed[0].FileName != "worksheet.pdf" {
		t.Fatalf("grading queue should show the file, got %+v", listed)
	}

	// The bytes come back as an attachment with the stored type.
	download := fixture.api.asRole("STUDENT", http.MethodGet, "/api/submissions/"+submissionID+"/file", nil)
	if download.Code != http.StatusOK {
		t.Fatalf("download: status %d body %s", download.Code, download.Body.String())
	}
	if got := download.Body.Bytes(); !bytes.Equal(got, first) {
		t.Errorf("download bytes = %q, want %q", got, first)
	}
	if got := download.Header().Get("Content-Type"); got != "application/pdf" {
		t.Errorf("Content-Type = %q, want application/pdf", got)
	}
	disposition := download.Header().Get("Content-Disposition")
	if !strings.HasPrefix(disposition, "attachment") || !strings.Contains(disposition, "worksheet.pdf") {
		t.Errorf("Content-Disposition = %q, want an attachment named worksheet.pdf", disposition)
	}
	if download.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Error("missing nosniff")
	}
	if download.Header().Get("Cache-Control") != "no-store" {
		t.Errorf("Cache-Control = %q, want no-store", download.Header().Get("Cache-Control"))
	}

	// A re-upload replaces the stored file instead of adding one.
	second := []byte("# My answer\n\nThe lens equation is 1/f = 1/v - 1/u.\n")
	replaced := fixture.uploadAs(t, "STUDENT", "answer.md", second)
	if replaced.Code != http.StatusOK {
		t.Fatalf("replace: status %d body %s", replaced.Code, replaced.Body.String())
	}
	var replacement submissionOut
	if err := json.NewDecoder(replaced.Body).Decode(&replacement); err != nil {
		t.Fatalf("decode replacement: %v", err)
	}
	if replacement.ID != submissionID {
		t.Errorf("re-upload moved the submission: %s -> %s", submissionID, replacement.ID)
	}
	if replacement.FileKind == nil || *replacement.FileKind != "md" {
		t.Errorf("replaced file_kind = %v, want md", replacement.FileKind)
	}
	var stored int
	if err := fixture.api.db.QueryRowContext(t.Context(), `SELECT COUNT(*) FROM submission_files`).Scan(&stored); err != nil {
		t.Fatalf("count files: %v", err)
	}
	if stored != 1 {
		t.Fatalf("%d files stored, want 1: a re-upload replaces", stored)
	}
	download = fixture.api.asRole("STUDENT", http.MethodGet, "/api/submissions/"+submissionID+"/file", nil)
	if !bytes.Equal(download.Body.Bytes(), second) {
		t.Errorf("download after replace = %q, want %q", download.Body.String(), second)
	}
	if got := download.Header().Get("Content-Type"); !strings.HasPrefix(got, "text/plain") {
		t.Errorf("Content-Type after replace = %q, want text/plain", got)
	}

	// Deleting the file keeps the submission row and clears the summary.
	gone := fixture.api.asRole("STUDENT", http.MethodDelete,
		"/api/assignments/"+fixture.assignmentID+"/submission/file", nil)
	if gone.Code != http.StatusNoContent {
		t.Fatalf("delete file: status %d body %s", gone.Code, gone.Body.String())
	}
	if again := fixture.api.asRole("STUDENT", http.MethodGet, "/api/submissions/"+submissionID+"/file", nil); again.Code != http.StatusNotFound {
		t.Errorf("deleted file still served: status %d", again.Code)
	}
	detail = fixture.api.asRole("STUDENT", http.MethodGet, "/api/assignments/"+fixture.assignmentID, nil)
	if err := json.NewDecoder(detail.Body).Decode(&payload); err != nil {
		t.Fatalf("decode detail after delete: %v", err)
	}
	if payload.Submission == nil {
		t.Fatal("deleting the file removed the submission")
	}
	if payload.Submission.FileName != nil || payload.Submission.FileKind != nil || payload.Submission.FileSize != nil {
		t.Errorf("file summary after delete = %v/%v/%v, want nulls",
			payload.Submission.FileName, payload.Submission.FileKind, payload.Submission.FileSize)
	}
	// Deleting again is a 404, not a silent success.
	if second := fixture.api.asRole("STUDENT", http.MethodDelete,
		"/api/assignments/"+fixture.assignmentID+"/submission/file", nil); second.Code != http.StatusNotFound {
		t.Errorf("second delete: status %d, want 404", second.Code)
	}
}

// A file-only assignment takes the file and leaves the written answer empty; a
// text-only assignment refuses a file outright.
func TestSubmissionFileRespectsSubmissionType(t *testing.T) {
	fileOnly := newSubmissionFixture(t, "file", "", true)
	recorder := fileOnly.uploadAs(t, "STUDENT", "worksheet.pdf", []byte("%PDF-1.7 body"))
	if recorder.Code != http.StatusCreated {
		t.Fatalf("file-only upload: status %d body %s", recorder.Code, recorder.Body.String())
	}
	var submission submissionOut
	if err := json.NewDecoder(recorder.Body).Decode(&submission); err != nil {
		t.Fatalf("decode submission: %v", err)
	}
	if submission.Content != "" {
		t.Errorf("content = %q, want empty on a file-only assignment", submission.Content)
	}
	if submission.FileURL != "" {
		t.Errorf("file_url = %q, want empty", submission.FileURL)
	}

	textOnly := newSubmissionFixture(t, "text", "", true)
	refused := textOnly.uploadAs(t, "STUDENT", "worksheet.pdf", []byte("%PDF-1.7 body"))
	if refused.Code != http.StatusBadRequest {
		t.Errorf("text-only upload: status %d, want 400 (body %s)", refused.Code, refused.Body.String())
	}
}

// Only an enrolled student hands work in (an administrator may try it), and only
// the owner or a grader downloads it.
func TestSubmissionFileOwnership(t *testing.T) {
	fixture := newSubmissionFixture(t, "both", "", true)
	fixture.addStudent(t, "outside@optimolms.dev", false)
	fixture.addStudent(t, "classmate@optimolms.dev", true)

	// Not enrolled: no hand-in.
	outsideCookie := fixture.api.signInAs("outside@optimolms.dev", "student123")
	refused := fixture.api.putSubmissionFile(outsideCookie, fixture.assignmentID, "worksheet.pdf", []byte("%PDF-1.7 body"))
	if refused.Code != http.StatusForbidden {
		t.Fatalf("non-enrolled upload: status %d body %s", refused.Code, refused.Body.String())
	}

	// A lecturer is not a student either.
	if got := fixture.uploadAs(t, "LECTURER", "worksheet.pdf", []byte("%PDF-1.7 body")); got.Code != http.StatusForbidden {
		t.Errorf("lecturer upload: status %d, want 403", got.Code)
	}

	uploaded := fixture.uploadAs(t, "STUDENT", "worksheet.pdf", []byte("%PDF-1.7 body"))
	if uploaded.Code != http.StatusCreated {
		t.Fatalf("student upload: status %d body %s", uploaded.Code, uploaded.Body.String())
	}
	var submission submissionOut
	if err := json.NewDecoder(uploaded.Body).Decode(&submission); err != nil {
		t.Fatalf("decode submission: %v", err)
	}
	path := "/api/submissions/" + submission.ID + "/file"

	// The owner reads it, the lecturer who grades it reads it, a classmate does
	// not — being in the same room is not permission.
	if got := fixture.api.asRole("STUDENT", http.MethodGet, path, nil); got.Code != http.StatusOK {
		t.Errorf("owner download: status %d, want 200", got.Code)
	}
	if got := fixture.api.asRole("LECTURER", http.MethodGet, path, nil); got.Code != http.StatusOK {
		t.Errorf("lecturer download: status %d, want 200", got.Code)
	}
	classmateCookie := fixture.api.signInAs("classmate@optimolms.dev", "student123")
	request := httptest.NewRequest(http.MethodGet, path, nil)
	request.AddCookie(classmateCookie)
	recorder := httptest.NewRecorder()
	fixture.api.app.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusForbidden {
		t.Errorf("classmate download: status %d, want 403 (body %s)", recorder.Code, recorder.Body.String())
	}

	// The classmate cannot delete somebody else's file: the route only ever
	// looks at the caller's own submission, so it is a 404.
	request = httptest.NewRequest(http.MethodDelete,
		"/api/assignments/"+fixture.assignmentID+"/submission/file", nil)
	request.AddCookie(classmateCookie)
	recorder = httptest.NewRecorder()
	fixture.api.app.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusNotFound {
		t.Errorf("classmate delete: status %d, want 404", recorder.Code)
	}
	if got := fixture.api.asRole("STUDENT", http.MethodGet, path, nil); got.Code != http.StatusOK {
		t.Errorf("classmate delete removed the file: status %d", got.Code)
	}
}

// A submitted file is checked against the settings and against its own bytes.
func TestSubmissionFileRejections(t *testing.T) {
	fixture := newSubmissionFixture(t, "both", "", true)

	for _, rejected := range []struct {
		name string
		body []byte
		code int
	}{
		{"installer.exe", []byte("MZ\x90\x00"), http.StatusUnsupportedMediaType},
		{"page.html", []byte("<h1>hi</h1>"), http.StatusUnsupportedMediaType},
		{"drawing.svg", []byte("<svg/>"), http.StatusUnsupportedMediaType},
		{"renamed.pdf", []byte("MZ\x90\x00 not a pdf"), http.StatusUnsupportedMediaType},
		{"notes.txt", []byte("text\x00with a nul"), http.StatusUnsupportedMediaType},
		{"worksheet", []byte("%PDF-1.7 no extension"), http.StatusUnsupportedMediaType},
		{"empty.pdf", nil, http.StatusBadRequest},
	} {
		got := fixture.uploadAs(t, "STUDENT", rejected.name, rejected.body)
		if got.Code != rejected.code {
			t.Errorf("%s: status %d, want %d (body %s)", rejected.name, got.Code, rejected.code, got.Body.String())
		}
	}
	var stored int
	if err := fixture.api.db.QueryRowContext(t.Context(), `SELECT COUNT(*) FROM submission_files`).Scan(&stored); err != nil {
		t.Fatalf("count files: %v", err)
	}
	if stored != 0 {
		t.Fatalf("%d files stored after only rejected uploads", stored)
	}

	// The allow-list is a setting: a type that passed a moment ago is refused
	// once an administrator tightens it.
	allowed := fixture.uploadAs(t, "STUDENT", "answer.md", []byte("# answer"))
	if allowed.Code != http.StatusCreated {
		t.Fatalf("markdown before the change: status %d body %s", allowed.Code, allowed.Body.String())
	}
	tightened := fixture.api.asRole("ADMIN", http.MethodPut, "/api/settings/general",
		map[string]any{"submission_allowed_file_types": []string{"pdf"}})
	if tightened.Code != http.StatusOK {
		t.Fatalf("tighten allow-list: status %d body %s", tightened.Code, tightened.Body.String())
	}
	if got := fixture.uploadAs(t, "STUDENT", "answer2.md", []byte("# answer")); got.Code != http.StatusUnsupportedMediaType {
		t.Errorf("markdown after the change: status %d, want 415", got.Code)
	}
	if got := fixture.uploadAs(t, "STUDENT", "worksheet.pdf", []byte("%PDF-1.7 body")); got.Code != http.StatusOK {
		t.Errorf("pdf after the change: status %d, want 200", got.Code)
	}

	// The size cap is a setting too.
	shrunk := fixture.api.asRole("ADMIN", http.MethodPut, "/api/settings/general",
		map[string]any{"submission_max_file_mb": 1})
	if shrunk.Code != http.StatusOK {
		t.Fatalf("shrink size cap: status %d body %s", shrunk.Code, shrunk.Body.String())
	}
	big := append([]byte("%PDF-1.7\n"), bytes.Repeat([]byte("x"), 2<<20)...)
	if got := fixture.uploadAs(t, "STUDENT", "huge.pdf", big); got.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("oversized upload: status %d, want 413 (body %s)", got.Code, got.Body.String())
	}
}

// The deadline decides the status of a file hand-in exactly as it does for text.
func TestSubmissionFileLateFlagging(t *testing.T) {
	past := time.Now().UTC().Add(-2 * time.Hour).Format(time.RFC3339)

	open := newSubmissionFixture(t, "both", past, true)
	recorder := open.uploadAs(t, "STUDENT", "late.pdf", []byte("%PDF-1.7 late"))
	if recorder.Code != http.StatusCreated {
		t.Fatalf("late upload: status %d body %s", recorder.Code, recorder.Body.String())
	}
	var submission submissionOut
	if err := json.NewDecoder(recorder.Body).Decode(&submission); err != nil {
		t.Fatalf("decode submission: %v", err)
	}
	if submission.Status != "late" {
		t.Errorf("status = %q, want late", submission.Status)
	}
	if submission.FileName == nil || *submission.FileName != "late.pdf" {
		t.Errorf("late upload lost its file: %+v", submission.FileName)
	}

	closed := newSubmissionFixture(t, "both", past, false)
	if got := closed.uploadAs(t, "STUDENT", "late.pdf", []byte("%PDF-1.7 late")); got.Code != http.StatusForbidden {
		t.Errorf("closed assignment upload: status %d, want 403 (body %s)", got.Code, got.Body.String())
	}
	var left int
	if err := closed.api.db.QueryRowContext(t.Context(),
		`SELECT COUNT(*) FROM assignment_submissions`).Scan(&left); err != nil {
		t.Fatalf("count submissions: %v", err)
	}
	if left != 0 {
		t.Errorf("a refused late upload created %d submissions", left)
	}

	// A future deadline is neither late nor refused.
	future := time.Now().UTC().Add(48 * time.Hour).Format(time.RFC3339)
	ahead := newSubmissionFixture(t, "both", future, false)
	recorder = ahead.uploadAs(t, "STUDENT", "early.pdf", []byte("%PDF-1.7 early"))
	if recorder.Code != http.StatusCreated {
		t.Fatalf("early upload: status %d body %s", recorder.Code, recorder.Body.String())
	}
	if err := json.NewDecoder(recorder.Body).Decode(&submission); err != nil {
		t.Fatalf("decode submission: %v", err)
	}
	if submission.Status != "submitted" {
		t.Errorf("status = %q, want submitted", submission.Status)
	}
}

// Renamed or path-carrying uploads are cleaned up, not rejected: the stored name
// is what a lecturer sees and what the download declares.
func TestSubmissionFileNameIsSanitized(t *testing.T) {
	fixture := newSubmissionFixture(t, "both", "", true)
	recorder := fixture.uploadAs(t, "STUDENT", "../../etc/pa ss/Worksheet.PDF", []byte("%PDF-1.7 body"))
	if recorder.Code != http.StatusCreated {
		t.Fatalf("upload: status %d body %s", recorder.Code, recorder.Body.String())
	}
	var submission submissionOut
	if err := json.NewDecoder(recorder.Body).Decode(&submission); err != nil {
		t.Fatalf("decode submission: %v", err)
	}
	if submission.FileName == nil || *submission.FileName != "Worksheet.PDF" {
		t.Errorf("file_name = %v, want the last path segment Worksheet.PDF", submission.FileName)
	}
	if submission.FileKind == nil || *submission.FileKind != "pdf" {
		t.Errorf("file_kind = %v, want pdf (the extension is matched case-insensitively)", submission.FileKind)
	}
	download := fixture.api.asRole("STUDENT", http.MethodGet, "/api/submissions/"+submission.ID+"/file", nil)
	if download.Code != http.StatusOK {
		t.Fatalf("download: status %d", download.Code)
	}
	if disposition := download.Header().Get("Content-Disposition"); strings.Contains(disposition, "..") || strings.Contains(disposition, "/etc") {
		t.Errorf("Content-Disposition leaks a path: %q", disposition)
	}
}
