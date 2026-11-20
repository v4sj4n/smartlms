package handler

import (
	"encoding/json"
	"net/http"
	"testing"

	"optimolms/backend/internal/util"
)

// rosterPayload is GET/POST /api/subjects/{id}/enrollments as the roster screen
// reads it.
type rosterPayload struct {
	Enrolled []struct {
		EnrollmentID string `json:"enrollment_id"`
		StudentID    string `json:"student_id"`
		Name         string `json:"name"`
		Email        string `json:"email"`
		EnrolledAt   string `json:"enrolled_at"`
	} `json:"enrolled"`
}

func (api *authAPI) readRoster(t *testing.T, role, subjectID string) rosterPayload {
	t.Helper()
	recorder := api.asRole(role, http.MethodGet, "/api/subjects/"+subjectID+"/enrollments", nil)
	if recorder.Code != http.StatusOK {
		t.Fatalf("roster: status %d body %s", recorder.Code, recorder.Body.String())
	}
	var payload rosterPayload
	if err := json.NewDecoder(recorder.Body).Decode(&payload); err != nil {
		t.Fatalf("decode roster: %v", err)
	}
	return payload
}

func (api *authAPI) rosterNames(payload rosterPayload) []string {
	names := make([]string, 0, len(payload.Enrolled))
	for _, row := range payload.Enrolled {
		names = append(names, row.Name)
	}
	return names
}

// newRosterStudent adds a throwaway student account. The password hash is never
// used: the test only needs somebody who can be put on a roster.
func (api *authAPI) newRosterStudent(t *testing.T, name, email string) string {
	t.Helper()
	id := util.NewID()
	now := util.Now()
	if _, err := api.db.Exec(`
		INSERT INTO users (id, email, password_hash, name, role_id, created_at, updated_at)
		VALUES (?, ?, 'x', ?, (SELECT id FROM roles WHERE name = 'STUDENT'), ?, ?)`,
		id, email, name, now, now); err != nil {
		t.Fatalf("create student %s: %v", email, err)
	}
	return id
}

func equalStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

// TestSubjectRosterEnrollAndUnenroll walks the roster through its whole life:
// the seeded list, a bulk add, the same add again (idempotent), a rejected id,
// then removing one student. Counts are taken relative to the seeded roster,
// because the demo population is already enrolled in the sample subjects.
func TestSubjectRosterEnrollAndUnenroll(t *testing.T) {
	api := newAuthAPI(t)
	subjectID := api.subjectIDByCode(t, "MATH101")

	// The seed enrolls the demo student in Mathematics I, among the generated
	// population. The roster is ordered by name and carries the account.
	seeded := api.readRoster(t, "LECTURER", subjectID)
	baseline := len(seeded.Enrolled)
	if baseline == 0 {
		t.Fatal("the seeded roster should not be empty")
	}
	if !api.namesAreSorted(seeded) {
		t.Fatalf("roster must be ordered by name: %v", api.rosterNames(seeded))
	}
	demoRow := -1
	for i, row := range seeded.Enrolled {
		if row.StudentID == api.users["STUDENT"] {
			demoRow = i
		}
		if row.EnrollmentID == "" || row.EnrolledAt == "" || row.Email == "" || row.Name == "" {
			t.Fatalf("roster row should carry the enrolment and the account: %+v", row)
		}
	}
	if demoRow < 0 {
		t.Fatalf("the demo student should be on the Mathematics roster: %v", api.rosterNames(seeded))
	}
	if name := seeded.Enrolled[demoRow].Name; name != "Student User" {
		t.Fatalf("roster row name: want Student User, got %q", name)
	}

	zoe := api.newRosterStudent(t, "Zoe Zeta", "zoe.zeta@people.optimolms.dev")
	adam := api.newRosterStudent(t, "Adam Alpha", "adam.alpha@people.optimolms.dev")

	recorder := api.asRole("ADMIN", http.MethodPost, "/api/subjects/"+subjectID+"/enrollments",
		map[string]any{"student_ids": []string{zoe, adam}})
	if recorder.Code != http.StatusOK {
		t.Fatalf("bulk enroll: status %d body %s", recorder.Code, recorder.Body.String())
	}
	var afterBulk rosterPayload
	if err := json.NewDecoder(recorder.Body).Decode(&afterBulk); err != nil {
		t.Fatalf("decode enrol response: %v", err)
	}
	// The response is the post-operation roster, ordered by name.
	if len(afterBulk.Enrolled) != baseline+2 {
		t.Fatalf("post-operation roster: want %d rows, got %d", baseline+2, len(afterBulk.Enrolled))
	}
	if !api.namesAreSorted(afterBulk) {
		t.Fatalf("post-operation roster must stay ordered by name: %v", api.rosterNames(afterBulk))
	}
	found := 0
	for _, row := range afterBulk.Enrolled {
		switch row.StudentID {
		case zoe:
			found++
			if row.Name != "Zoe Zeta" || row.Email != "zoe.zeta@people.optimolms.dev" {
				t.Fatalf("enrolled row should carry the account, got %+v", row)
			}
			if row.EnrollmentID == "" || row.EnrolledAt == "" {
				t.Fatalf("enrolled row is missing its id or date: %+v", row)
			}
		case adam:
			found++
		}
	}
	if found != 2 {
		t.Fatalf("the bulk enroll did not add both students: %v", api.rosterNames(afterBulk))
	}

	// Posting the same list again changes nothing: enrolling is idempotent.
	recorder = api.asRole("ADMIN", http.MethodPost, "/api/subjects/"+subjectID+"/enrollments",
		map[string]any{"student_ids": []string{adam, zoe, adam}})
	if recorder.Code != http.StatusOK {
		t.Fatalf("repeat enroll: status %d body %s", recorder.Code, recorder.Body.String())
	}
	var afterRepeat rosterPayload
	if err := json.NewDecoder(recorder.Body).Decode(&afterRepeat); err != nil {
		t.Fatalf("decode repeat response: %v", err)
	}
	if len(afterRepeat.Enrolled) != baseline+2 {
		t.Fatalf("repeat enroll must not duplicate rows: want %d, got %d", baseline+2, len(afterRepeat.Enrolled))
	}

	// An id that names nobody is a client bug, not a silent skip: 400, and the
	// roster is left exactly as it was.
	recorder = api.asRole("ADMIN", http.MethodPost, "/api/subjects/"+subjectID+"/enrollments",
		map[string]any{"student_ids": []string{adam, "not-a-user"}})
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("unknown id: want 400, got %d body %s", recorder.Code, recorder.Body.String())
	}
	// A lecturer cannot be enrolled as a student either.
	recorder = api.asRole("ADMIN", http.MethodPost, "/api/subjects/"+subjectID+"/enrollments",
		map[string]any{"student_ids": []string{api.users["LECTURER"]}})
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("non-student id: want 400, got %d body %s", recorder.Code, recorder.Body.String())
	}
	// An empty list is a bug too, not a no-op success.
	recorder = api.asRole("ADMIN", http.MethodPost, "/api/subjects/"+subjectID+"/enrollments",
		map[string]any{"student_ids": []string{}})
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("empty list: want 400, got %d body %s", recorder.Code, recorder.Body.String())
	}
	if roster := api.readRoster(t, "ADMIN", subjectID); len(roster.Enrolled) != baseline+2 {
		t.Fatalf("a rejected request must not touch the roster: want %d, got %d", baseline+2, len(roster.Enrolled))
	}

	// Removing a student takes the enrolment row away and nothing else.
	assignmentID := api.firstAssignmentID(t, subjectID)
	if _, err := api.db.Exec(`
		INSERT INTO assignment_submissions (id, assignment_id, student_id, content, status, submitted_at, updated_at)
		VALUES (?, ?, ?, 'worked it out', 'submitted', ?, ?)`,
		util.NewID(), assignmentID, zoe, util.Now(), util.Now()); err != nil {
		t.Fatalf("seed submission: %v", err)
	}
	recorder = api.asRole("LECTURER", http.MethodDelete, "/api/subjects/"+subjectID+"/enrollments/"+zoe, nil)
	if recorder.Code != http.StatusNoContent {
		t.Fatalf("unenroll: status %d body %s", recorder.Code, recorder.Body.String())
	}
	var submissions int
	if err := api.db.QueryRow(`SELECT COUNT(*) FROM assignment_submissions WHERE student_id = ? AND assignment_id = ?`,
		zoe, assignmentID).Scan(&submissions); err != nil {
		t.Fatalf("count submissions: %v", err)
	}
	if submissions != 1 {
		t.Fatalf("grade history must outlive the enrolment, submissions left: %d", submissions)
	}

	// Unenrolling twice reports the second call as a miss.
	recorder = api.asRole("LECTURER", http.MethodDelete, "/api/subjects/"+subjectID+"/enrollments/"+zoe, nil)
	if recorder.Code != http.StatusNotFound {
		t.Fatalf("second unenroll: want 404, got %d body %s", recorder.Code, recorder.Body.String())
	}
	if roster := api.readRoster(t, "LECTURER", subjectID); len(roster.Enrolled) != baseline+1 {
		t.Fatalf("roster after unenroll: want %d, got %d", baseline+1, len(roster.Enrolled))
	}

	// An unknown subject is a miss on both verbs.
	if recorder := api.asRole("ADMIN", http.MethodGet, "/api/subjects/not-a-subject/enrollments", nil); recorder.Code != http.StatusNotFound {
		t.Fatalf("unknown subject roster: want 404, got %d", recorder.Code)
	}
	if recorder := api.asRole("ADMIN", http.MethodPost, "/api/subjects/not-a-subject/enrollments",
		map[string]any{"student_ids": []string{adam}}); recorder.Code != http.StatusNotFound {
		t.Fatalf("unknown subject enroll: want 404, got %d", recorder.Code)
	}
}

// namesAreSorted reports whether the roster comes back ordered by name, which is
// the order the screen renders.
func (api *authAPI) namesAreSorted(payload rosterPayload) bool {
	for i := 1; i < len(payload.Enrolled); i++ {
		if payload.Enrolled[i-1].Name > payload.Enrolled[i].Name {
			return false
		}
	}
	return true
}

// TestSubjectRosterPermissions: reading the roster needs subjects.view, changing
// it needs subjects.manage. A student holds the first and not the second.
func TestSubjectRosterPermissions(t *testing.T) {
	api := newAuthAPI(t)
	subjectID := api.subjectIDByCode(t, "MATH101")

	if recorder := api.asRole("STUDENT", http.MethodGet, "/api/subjects/"+subjectID+"/enrollments", nil); recorder.Code != http.StatusOK {
		t.Fatalf("student reading the roster: want 200, got %d body %s", recorder.Code, recorder.Body.String())
	}
	if recorder := api.asRole("STUDENT", http.MethodPost, "/api/subjects/"+subjectID+"/enrollments",
		map[string]any{"student_ids": []string{api.users["STUDENT"]}}); recorder.Code != http.StatusForbidden {
		t.Fatalf("student enrolling: want 403, got %d body %s", recorder.Code, recorder.Body.String())
	}
	if recorder := api.asRole("STUDENT", http.MethodDelete,
		"/api/subjects/"+subjectID+"/enrollments/"+api.users["STUDENT"], nil); recorder.Code != http.StatusForbidden {
		t.Fatalf("student unenrolling: want 403, got %d body %s", recorder.Code, recorder.Body.String())
	}
	if recorder := api.post(http.MethodGet, "/api/subjects/"+subjectID+"/enrollments", nil, nil); recorder.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous roster: want 401, got %d", recorder.Code)
	}
}

// firstAssignmentID returns one assignment of a subject, for tests that need a
// submission to survive an unenrolment.
func (api *authAPI) firstAssignmentID(t *testing.T, subjectID string) string {
	t.Helper()
	var id string
	if err := api.db.QueryRow(`SELECT id FROM assignments WHERE subject_id = ? ORDER BY title LIMIT 1`, subjectID).Scan(&id); err != nil {
		t.Fatalf("assignment of subject %s: %v", subjectID, err)
	}
	return id
}

/* ---------- the study record's per-subject school year ------------------- */

// TestRecordEntriesCarryTheSubjectSchoolYear pins the field the study card
// groups by: every entry reports its subject's own school_year verbatim, an
// empty string included, and always on the wire.
func TestRecordEntriesCarryTheSubjectSchoolYear(t *testing.T) {
	api := newAuthAPI(t)
	studentID := api.users["STUDENT"]

	// A second subject on the record with no school year of its own, so the
	// empty-string case is covered as well as the seeded 2026/2027 one.
	extraID := api.newScheduleSubject(t, map[string]any{"name": "Algorithms", "code": "ALG101"})
	if _, err := api.db.Exec(`UPDATE subjects SET school_year = NULL WHERE id = ?`, extraID); err != nil {
		t.Fatalf("clear school year: %v", err)
	}
	recorder := api.asRole("ADMIN", http.MethodPost, "/api/subjects/"+extraID+"/enrollments",
		map[string]any{"student_ids": []string{studentID}})
	if recorder.Code != http.StatusOK {
		t.Fatalf("enroll student: status %d body %s", recorder.Code, recorder.Body.String())
	}

	recorder = api.asRole("STUDENT", http.MethodGet, "/api/students/"+studentID+"/record", nil)
	if recorder.Code != http.StatusOK {
		t.Fatalf("record: status %d body %s", recorder.Code, recorder.Body.String())
	}
	// Decoded as raw maps: the assertion is about the key being there at all,
	// which a struct with omitempty would hide.
	var payload struct {
		Entries []map[string]any `json:"entries"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&payload); err != nil {
		t.Fatalf("decode record: %v", err)
	}
	if len(payload.Entries) < 3 {
		t.Fatalf("want the two seeded subjects plus the new one, got %+v", payload.Entries)
	}

	sawSeed, sawEmpty := false, false
	for _, entry := range payload.Entries {
		subjectID, ok := entry["subject_id"].(string)
		if !ok || subjectID == "" {
			t.Fatalf("entry without a subject id: %+v", entry)
		}
		raw, present := entry["school_year"]
		if !present {
			t.Fatalf("entry %s has no school_year field: %+v", subjectID, entry)
		}
		year, isString := raw.(string)
		if !isString {
			t.Fatalf("school_year should be a string, got %T in %+v", raw, entry)
		}
		var want string
		if err := api.db.QueryRow(`SELECT COALESCE(school_year, '') FROM subjects WHERE id = ?`, subjectID).
			Scan(&want); err != nil {
			t.Fatalf("subject %s: %v", subjectID, err)
		}
		if year != want {
			t.Fatalf("school_year of %s: want %q (the subject's own), got %q", subjectID, want, year)
		}
		switch subjectID {
		case extraID:
			sawEmpty = true
			if year != "" {
				t.Fatalf("a subject without a school year must report an empty string, got %q", year)
			}
		case api.subjectIDByCode(t, "MATH101"):
			sawSeed = true
			if year != "2026/2027" {
				t.Fatalf("Mathematics I school_year: want 2026/2027, got %q", year)
			}
		}
	}
	if !sawSeed || !sawEmpty {
		t.Fatalf("record should carry both the seeded and the empty year (seed=%v empty=%v): %+v",
			sawSeed, sawEmpty, payload.Entries)
	}
}

/* ---------- the catalogue a caller sees --------------------------------- */

// cataloguePayload is GET /api/subjects as the subjects screen reads it.
type cataloguePayload struct {
	Items []struct {
		ID   string `json:"id"`
		Name string `json:"name"`
		Code string `json:"code"`
	} `json:"items"`
	Total    int `json:"total"`
	Page     int `json:"page"`
	PageSize int `json:"page_size"`
}

func (api *authAPI) readCatalogue(t *testing.T, role, query string) cataloguePayload {
	t.Helper()
	recorder := api.asRole(role, http.MethodGet, "/api/subjects"+query, nil)
	if recorder.Code != http.StatusOK {
		t.Fatalf("catalogue as %s%s: status %d body %s", role, query, recorder.Code, recorder.Body.String())
	}
	var payload cataloguePayload
	if err := json.NewDecoder(recorder.Body).Decode(&payload); err != nil {
		t.Fatalf("decode catalogue: %v", err)
	}
	return payload
}

func (api *authAPI) catalogueCodes(payload cataloguePayload) []string {
	codes := make([]string, 0, len(payload.Items))
	for _, item := range payload.Items {
		codes = append(codes, item.Code)
	}
	return codes
}

// TestSubjectCatalogueScoping: students only see the subjects they are enrolled
// in, a lecturer sees the subjects they teach, an administrator sees everything,
// and a subject somebody else studies is a 403 on the detail, not a 404.
func TestSubjectCatalogueScoping(t *testing.T) {
	api := newAuthAPI(t)
	studentID := api.users["STUDENT"]

	// One subject the demo lecturer teaches, one nobody teaches.
	taughtID := api.newScheduleSubject(t, map[string]any{
		"name": "Algorithms", "code": "ALG101", "lecturer_id": api.users["LECTURER"],
	})
	orphanID := api.newScheduleSubject(t, map[string]any{"name": "Business Basics", "code": "BUS101"})

	// The student: the seeded roster and nothing else.
	var enrolled int
	if err := api.db.QueryRow(`SELECT COUNT(*) FROM enrollments WHERE student_id = ?`, studentID).Scan(&enrolled); err != nil {
		t.Fatalf("count enrolments: %v", err)
	}
	studentCatalogue := api.readCatalogue(t, "STUDENT", "")
	if studentCatalogue.Total != enrolled || len(studentCatalogue.Items) != enrolled {
		t.Fatalf("student catalogue: want %d enrolled subjects, got total %d items %d",
			enrolled, studentCatalogue.Total, len(studentCatalogue.Items))
	}
	if codes := api.catalogueCodes(studentCatalogue); contains(codes, "ALG101") || contains(codes, "BUS101") {
		t.Fatalf("student must not see subjects they are not enrolled in: %v", codes)
	}
	if !contains(api.catalogueCodes(studentCatalogue), "MATH101") {
		t.Fatalf("student should see the seeded subject they study: %v", api.catalogueCodes(studentCatalogue))
	}
	// Pagination is untouched by the scoping.
	if studentCatalogue.Page != 1 || studentCatalogue.PageSize != 10 {
		t.Fatalf("student catalogue paging: %+v", studentCatalogue)
	}

	// The lecturer: the subjects they teach (ALG101 is theirs now, MATH101 and
	// PHYS101 come seeded), but not the one with no lecturer of record.
	lecturerCatalogue := api.readCatalogue(t, "LECTURER", "")
	lecturerCodes := api.catalogueCodes(lecturerCatalogue)
	for _, want := range []string{"ALG101", "MATH101", "PHYS101"} {
		if !contains(lecturerCodes, want) {
			t.Fatalf("lecturer should see %s: %v", want, lecturerCodes)
		}
	}
	if contains(lecturerCodes, "BUS101") {
		t.Fatalf("a lecturer must not see a subject they do not teach: %v", lecturerCodes)
	}

	// The administrator: everything, with the same paging contract.
	var allSubjects int
	if err := api.db.QueryRow(`SELECT COUNT(*) FROM subjects`).Scan(&allSubjects); err != nil {
		t.Fatalf("count subjects: %v", err)
	}
	adminCatalogue := api.readCatalogue(t, "ADMIN", "?page_size=100")
	if adminCatalogue.Total != allSubjects || len(adminCatalogue.Items) != allSubjects {
		t.Fatalf("admin catalogue: want %d subjects, got total %d items %d",
			allSubjects, adminCatalogue.Total, len(adminCatalogue.Items))
	}
	if !contains(api.catalogueCodes(adminCatalogue), "BUS101") {
		t.Fatalf("admin should see every subject: %v", api.catalogueCodes(adminCatalogue))
	}
	// Paging still works on top of the filter.
	paged := api.readCatalogue(t, "ADMIN", "?page=2&page_size=1")
	if paged.Total != allSubjects || len(paged.Items) != 1 || paged.Page != 2 || paged.PageSize != 1 {
		t.Fatalf("paged catalogue: %+v", paged)
	}

	// Detail: enrolled students and the lecturer of record get in, everybody
	// else is refused (403 — the subject exists, they just do not study it).
	mathsID := api.subjectIDByCode(t, "MATH101")
	if recorder := api.asRole("STUDENT", http.MethodGet, "/api/subjects/"+mathsID, nil); recorder.Code != http.StatusOK {
		t.Fatalf("enrolled student on the subject page: want 200, got %d body %s", recorder.Code, recorder.Body.String())
	}
	if recorder := api.asRole("STUDENT", http.MethodGet, "/api/subjects/"+taughtID, nil); recorder.Code != http.StatusForbidden {
		t.Fatalf("student on a subject they do not study: want 403, got %d body %s", recorder.Code, recorder.Body.String())
	}
	if recorder := api.asRole("LECTURER", http.MethodGet, "/api/subjects/"+taughtID, nil); recorder.Code != http.StatusOK {
		t.Fatalf("lecturer on their own subject: want 200, got %d body %s", recorder.Code, recorder.Body.String())
	}
	if recorder := api.asRole("LECTURER", http.MethodGet, "/api/subjects/"+orphanID, nil); recorder.Code != http.StatusForbidden {
		t.Fatalf("lecturer on a subject they do not teach: want 403, got %d body %s", recorder.Code, recorder.Body.String())
	}
	if recorder := api.asRole("ADMIN", http.MethodGet, "/api/subjects/"+orphanID, nil); recorder.Code != http.StatusOK {
		t.Fatalf("admin on any subject: want 200, got %d body %s", recorder.Code, recorder.Body.String())
	}
	// Enrolling the student opens the page they could not see.
	if recorder := api.asRole("ADMIN", http.MethodPost, "/api/subjects/"+taughtID+"/enrollments",
		map[string]any{"student_ids": []string{studentID}}); recorder.Code != http.StatusOK {
		t.Fatalf("enroll student: %d %s", recorder.Code, recorder.Body.String())
	}
	if recorder := api.asRole("STUDENT", http.MethodGet, "/api/subjects/"+taughtID, nil); recorder.Code != http.StatusOK {
		t.Fatalf("student on a subject they were just enrolled in: want 200, got %d body %s", recorder.Code, recorder.Body.String())
	}
	// A subject that does not exist is still a 404 for everybody.
	if recorder := api.asRole("ADMIN", http.MethodGet, "/api/subjects/not-a-subject", nil); recorder.Code != http.StatusNotFound {
		t.Fatalf("missing subject: want 404, got %d", recorder.Code)
	}
}
