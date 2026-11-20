package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"path/filepath"
	"testing"

	"smartlms/backend/internal/db"
	"smartlms/backend/internal/util"
)

// academicIDs are the people the tests admit and teach: one student, one
// lecturer.
type academicIDs struct {
	student  string
	lecturer string
}

// academicAPI builds the academic endpoints (plus the subject endpoints, since
// courses are assigned through both) over a throwaway database, so the tests
// run the real SQL, the real constraints and the partial unique index.
func academicAPI(t *testing.T) (*sql.DB, *http.ServeMux, academicIDs) {
	t.Helper()
	database, err := db.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })
	if err := db.Migrate(context.Background(), database); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	ids := academicIDs{}
	roleID := map[string]string{}
	for _, role := range []string{"STUDENT", "LECTURER"} {
		id := util.NewID()
		if _, err := database.Exec(
			`INSERT INTO roles (id, name, max_login_attempts, lock_minutes) VALUES (?, ?, 5, 15)`,
			id, role); err != nil {
			t.Fatalf("insert role %s: %v", role, err)
		}
		roleID[role] = id
	}
	now := util.Now()
	insertUser := func(email, name, role string) string {
		id := util.NewID()
		if _, err := database.Exec(`
			INSERT INTO users (id, email, password_hash, name, role_id, created_at, updated_at)
			VALUES (?, ?, 'x', ?, ?, ?, ?)`, id, email, name, roleID[role], now, now); err != nil {
			t.Fatalf("insert user %s: %v", email, err)
		}
		return id
	}
	ids.student = insertUser("student@school.edu", "Student User", "STUDENT")
	ids.lecturer = insertUser("lecturer@school.edu", "Lecturer User", "LECTURER")

	mux := http.NewServeMux()
	registerAcademic(mux, database)
	registerSubjects(mux, database)
	return database, mux, ids
}

// createStructure makes one faculty, one department and one programme, and
// returns their ids.
func createStructure(t *testing.T, mux *http.ServeMux) (facultyID, departmentID, programmeID string) {
	t.Helper()

	recorder := call(t, mux, http.MethodPost, "/api/faculties", map[string]any{
		"name": "Faculty of Natural Sciences", "code": "FNS",
	})
	if recorder.Code != http.StatusCreated {
		t.Fatalf("create faculty: status %d body %s", recorder.Code, recorder.Body.String())
	}
	var faculty facultyOut
	if err := json.NewDecoder(recorder.Body).Decode(&faculty); err != nil {
		t.Fatalf("decode faculty: %v", err)
	}

	recorder = call(t, mux, http.MethodPost, "/api/departments", map[string]any{
		"faculty_id": faculty.ID, "name": "Department of Computer Science", "code": "CS",
	})
	if recorder.Code != http.StatusCreated {
		t.Fatalf("create department: status %d body %s", recorder.Code, recorder.Body.String())
	}
	var department departmentOut
	if err := json.NewDecoder(recorder.Body).Decode(&department); err != nil {
		t.Fatalf("decode department: %v", err)
	}

	recorder = call(t, mux, http.MethodPost, "/api/programmes", map[string]any{
		"department_id": department.ID, "name": "Computer Science",
		"code": "BSc-CS", "level": "BACHELOR", "duration_years": 3, "total_ects": 180,
	})
	if recorder.Code != http.StatusCreated {
		t.Fatalf("create programme: status %d body %s", recorder.Code, recorder.Body.String())
	}
	var programme programmeRowOut
	if err := json.NewDecoder(recorder.Body).Decode(&programme); err != nil {
		t.Fatalf("decode programme: %v", err)
	}
	return faculty.ID, department.ID, programme.ID
}

func academicTree(t *testing.T, mux *http.ServeMux) academicOut {
	t.Helper()
	recorder := call(t, mux, http.MethodGet, "/api/academic", nil)
	if recorder.Code != http.StatusOK {
		t.Fatalf("get tree: status %d body %s", recorder.Code, recorder.Body.String())
	}
	var out academicOut
	if err := json.NewDecoder(recorder.Body).Decode(&out); err != nil {
		t.Fatalf("decode tree: %v", err)
	}
	return out
}

// The tree is nested the way the institution is: a faculty holds departments,
// a department holds programmes.
func TestAcademicTreeNestsProgrammes(t *testing.T) {
	_, mux, _ := academicAPI(t)
	createStructure(t, mux)

	out := academicTree(t, mux)
	if len(out.Faculties) != 1 {
		t.Fatalf("faculties: want 1, got %d", len(out.Faculties))
	}
	faculty := out.Faculties[0]
	if len(faculty.Departments) != 1 {
		t.Fatalf("departments: want 1, got %d", len(faculty.Departments))
	}
	department := faculty.Departments[0]
	if len(department.Programmes) != 1 {
		t.Fatalf("programmes: want 1, got %d", len(department.Programmes))
	}
	programme := department.Programmes[0]
	if programme.Name != "Computer Science" || programme.Level != "BACHELOR" || programme.DurationYears != 3 {
		t.Fatalf("unexpected programme: %+v", programme)
	}
	if out.UnplacedStudents != 1 {
		t.Fatalf("unplaced students: want the one student, got %d", out.UnplacedStudents)
	}
}

// One student, one active programme: a second admission is refused until the
// first one is ended.
func TestOneActiveProgrammePerStudent(t *testing.T) {
	_, mux, ids := academicAPI(t)
	_, _, programmeID := createStructure(t, mux)

	recorder := call(t, mux, http.MethodPost, "/api/programmes/"+programmeID+"/students", map[string]any{
		"student_id": ids.student, "year_of_study": 2,
	})
	if recorder.Code != http.StatusCreated {
		t.Fatalf("admit: status %d body %s", recorder.Code, recorder.Body.String())
	}

	var admission programmeStudentOut
	if err := json.NewDecoder(recorder.Body).Decode(&admission); err != nil {
		t.Fatalf("decode admission: %v", err)
	}
	if admission.Status != "ACTIVE" || admission.YearOfStudy != 2 {
		t.Fatalf("unexpected admission: %+v", admission)
	}

	// A second programme: the placement constraint refuses another ACTIVE row.
	recorder = call(t, mux, http.MethodPost, "/api/departments", map[string]any{
		"faculty_id": academicTree(t, mux).Faculties[0].ID, "name": "Department of Mathematics",
	})
	var department departmentOut
	if err := json.NewDecoder(recorder.Body).Decode(&department); err != nil {
		t.Fatalf("decode department: %v", err)
	}
	recorder = call(t, mux, http.MethodPost, "/api/programmes", map[string]any{
		"department_id": department.ID, "name": "Mathematics", "duration_years": 3,
	})
	var other programmeRowOut
	if err := json.NewDecoder(recorder.Body).Decode(&other); err != nil {
		t.Fatalf("decode programme: %v", err)
	}

	recorder = call(t, mux, http.MethodPost, "/api/programmes/"+other.ID+"/students", map[string]any{
		"student_id": ids.student,
	})
	if recorder.Code != http.StatusConflict {
		t.Fatalf("second admission: want 409, got %d body %s", recorder.Code, recorder.Body.String())
	}

	// Ending the first admission lets the student move.
	recorder = call(t, mux, http.MethodPatch, "/api/programme-enrollments/"+admission.EnrollmentID, map[string]any{
		"status": "WITHDRAWN",
	})
	if recorder.Code != http.StatusNoContent {
		t.Fatalf("withdraw: status %d body %s", recorder.Code, recorder.Body.String())
	}
	recorder = call(t, mux, http.MethodPost, "/api/programmes/"+other.ID+"/students", map[string]any{
		"student_id": ids.student,
	})
	if recorder.Code != http.StatusCreated {
		t.Fatalf("admission after withdrawal: status %d body %s", recorder.Code, recorder.Body.String())
	}
}

// A year of study only means something inside the programme's own length.
func TestYearOfStudyMustFitTheProgramme(t *testing.T) {
	_, mux, ids := academicAPI(t)
	_, _, programmeID := createStructure(t, mux)

	recorder := call(t, mux, http.MethodPost, "/api/programmes/"+programmeID+"/students", map[string]any{
		"student_id": ids.student, "year_of_study": 5,
	})
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("year out of range: want 400, got %d body %s", recorder.Code, recorder.Body.String())
	}
}

// Only student accounts are admitted, never staff.
func TestOnlyStudentsAreAdmitted(t *testing.T) {
	_, mux, ids := academicAPI(t)
	_, _, programmeID := createStructure(t, mux)

	recorder := call(t, mux, http.MethodPost, "/api/programmes/"+programmeID+"/students", map[string]any{
		"student_id": ids.lecturer,
	})
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("lecturer admission: want 400, got %d body %s", recorder.Code, recorder.Body.String())
	}
}

// Deleting a level is refused while something still hangs off it, so a
// structure is dismantled from the bottom up.
func TestDeletingTheStructureIsGuarded(t *testing.T) {
	_, mux, _ := academicAPI(t)
	facultyID, departmentID, programmeID := createStructure(t, mux)

	recorder := call(t, mux, http.MethodDelete, "/api/faculties/"+facultyID, nil)
	if recorder.Code != http.StatusConflict {
		t.Fatalf("delete faculty with departments: want 409, got %d body %s", recorder.Code, recorder.Body.String())
	}
	recorder = call(t, mux, http.MethodDelete, "/api/departments/"+departmentID, nil)
	if recorder.Code != http.StatusConflict {
		t.Fatalf("delete department with programmes: want 409, got %d body %s", recorder.Code, recorder.Body.String())
	}

	// A course on the programme blocks it too.
	recorder = call(t, mux, http.MethodPost, "/api/subjects", map[string]any{
		"name": "Algorithms", "code": "CS201", "programme_id": programmeID, "year_of_study": 2,
	})
	if recorder.Code != http.StatusCreated {
		t.Fatalf("create course: status %d body %s", recorder.Code, recorder.Body.String())
	}
	recorder = call(t, mux, http.MethodDelete, "/api/programmes/"+programmeID, nil)
	if recorder.Code != http.StatusConflict {
		t.Fatalf("delete programme with courses: want 409, got %d body %s", recorder.Code, recorder.Body.String())
	}
}

// A programme owns its courses: assigning one makes it appear in the programme,
// unassigning it takes it back out of the curriculum without deleting it.
func TestProgrammeCoursesFollowAssignment(t *testing.T) {
	_, mux, _ := academicAPI(t)
	_, _, programmeID := createStructure(t, mux)

	recorder := call(t, mux, http.MethodPost, "/api/subjects", map[string]any{
		"name": "Algorithms", "code": "CS201", "ects": 6, "year_of_study": 0,
	})
	if recorder.Code != http.StatusCreated {
		t.Fatalf("create course: status %d body %s", recorder.Code, recorder.Body.String())
	}
	var created struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&created); err != nil {
		t.Fatalf("decode course: %v", err)
	}

	recorder = call(t, mux, http.MethodPost, "/api/programmes/"+programmeID+"/courses", map[string]any{
		"subject_id": created.ID, "year_of_study": 2,
	})
	if recorder.Code != http.StatusNoContent {
		t.Fatalf("assign course: status %d body %s", recorder.Code, recorder.Body.String())
	}

	detail := getProgrammeDetail(t, mux, programmeID)
	if len(detail.Courses) != 1 || detail.Courses[0].Name != "Algorithms" || detail.Courses[0].YearOfStudy != 2 {
		t.Fatalf("unexpected courses: %+v", detail.Courses)
	}

	recorder = call(t, mux, http.MethodDelete,
		"/api/programmes/"+programmeID+"/courses/"+created.ID, nil)
	if recorder.Code != http.StatusNoContent {
		t.Fatalf("unassign course: status %d body %s", recorder.Code, recorder.Body.String())
	}
	detail = getProgrammeDetail(t, mux, programmeID)
	if len(detail.Courses) != 0 {
		t.Fatalf("courses after unassign: want none, got %+v", detail.Courses)
	}

	// The course itself survives, it is simply unassigned.
	recorder = call(t, mux, http.MethodGet, "/api/subjects/"+created.ID, nil)
	if recorder.Code != http.StatusOK {
		t.Fatalf("course after unassign: status %d body %s", recorder.Code, recorder.Body.String())
	}
	var subject subjectOut
	if err := json.NewDecoder(recorder.Body).Decode(&subject); err != nil {
		t.Fatalf("decode subject: %v", err)
	}
	if subject.ProgrammeID != "" || subject.YearOfStudy != 0 {
		t.Fatalf("course should be unassigned, got %+v", subject)
	}
}

// The subject form is where a course is filed under a programme; an unknown one
// is rejected instead of silently stored.
func TestSubjectRejectsUnknownProgramme(t *testing.T) {
	_, mux, _ := academicAPI(t)

	recorder := call(t, mux, http.MethodPost, "/api/subjects", map[string]any{
		"name": "Algorithms", "programme_id": "no-such-programme",
	})
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("unknown programme: want 400, got %d body %s", recorder.Code, recorder.Body.String())
	}
}

func getProgrammeDetail(t *testing.T, mux *http.ServeMux, id string) programmeDetailOut {
	t.Helper()
	recorder := call(t, mux, http.MethodGet, "/api/programmes/"+id, nil)
	if recorder.Code != http.StatusOK {
		t.Fatalf("get programme: status %d body %s", recorder.Code, recorder.Body.String())
	}
	var out programmeDetailOut
	if err := json.NewDecoder(recorder.Body).Decode(&out); err != nil {
		t.Fatalf("decode programme detail: %v", err)
	}
	return out
}
