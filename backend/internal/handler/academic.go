package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"optimolms/backend/internal/util"
)

// The academic structure the institution runs on:
//
//	faculty (Fakulteti) -> department (Departamenti) -> programme (Dega)
//
// A programme is what a student is admitted to and what owns the subjects of
// its curriculum. Course enrolment (`enrollments`) stays a separate thing: it
// answers "who sits in this subject", while an admission answers "which
// programme does this student belong to".

type programmeRowOut struct {
	ID            string `json:"id"`
	DepartmentID  string `json:"department_id"`
	Name          string `json:"name"`
	Code          string `json:"code,omitempty"`
	Level         string `json:"level"`
	DurationYears int    `json:"duration_years"`
	TotalECTS     int    `json:"total_ects,omitempty"`
	Courses       int    `json:"courses"`
	Students      int    `json:"students"`
}

type departmentOut struct {
	ID         string            `json:"id"`
	FacultyID  string            `json:"faculty_id"`
	Name       string            `json:"name"`
	Code       string            `json:"code,omitempty"`
	Students   int               `json:"students"`
	Programmes []programmeRowOut `json:"programmes"`
}

type facultyOut struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Code        string          `json:"code,omitempty"`
	Students    int             `json:"students"`
	Departments []departmentOut `json:"departments"`
}

// academicOut is the whole tree in one response, plus the two counts an
// administrator can act on: courses with no programme and students with no
// active admission.
type academicOut struct {
	Faculties         []facultyOut `json:"faculties"`
	UnassignedCourses int          `json:"unassigned_courses"`
	UnplacedStudents  int          `json:"unplaced_students"`
}

type programmeOut struct {
	programmeRowOut
	Description    string `json:"description,omitempty"`
	FacultyID      string `json:"faculty_id"`
	FacultyName    string `json:"faculty_name"`
	DepartmentName string `json:"department_name"`
}

type programmeCourseOut struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	Code         string  `json:"code,omitempty"`
	LecturerName string  `json:"lecturer_name,omitempty"`
	ECTS         float64 `json:"ects,omitempty"`
	Semester     string  `json:"semester"`
	SchoolYear   string  `json:"school_year,omitempty"`
	YearOfStudy  int     `json:"year_of_study"`
}

type programmeStudentOut struct {
	EnrollmentID string `json:"enrollment_id"`
	StudentID    string `json:"student_id"`
	Name         string `json:"name"`
	Email        string `json:"email"`
	SchoolYear   string `json:"school_year,omitempty"`
	YearOfStudy  int    `json:"year_of_study"`
	Status       string `json:"status"`
	EnrolledAt   string `json:"enrolled_at"`
}

type programmeDetailOut struct {
	Programme programmeOut          `json:"programme"`
	Courses   []programmeCourseOut  `json:"courses"`
	Students  []programmeStudentOut `json:"students"`
}

// Admission states. ACTIVE is what "currently studies here" means; a student
// has at most one ACTIVE admission, enforced by a partial unique index.
var programmeStatuses = map[string]bool{
	"ACTIVE":    true,
	"GRADUATED": true,
	"WITHDRAWN": true,
	"SUSPENDED": true,
}

// normaliseLevel validates a programme level, defaulting to a bachelor's, the
// common case.
func normaliseLevel(raw string) (string, bool) {
	switch strings.ToUpper(strings.TrimSpace(raw)) {
	case "":
		return "BACHELOR", true
	case "BACHELOR", "MASTER", "DOCTORATE":
		return strings.ToUpper(strings.TrimSpace(raw)), true
	default:
		return "", false
	}
}

// defaultYears is the usual length of a degree of this level, used when the
// form leaves the duration out.
func defaultYears(level string) int {
	if level == "MASTER" {
		return 2
	}
	return 3
}

// normaliseStatus validates an admission status, defaulting to active.
func normaliseStatus(raw string) (string, bool) {
	status := strings.ToUpper(strings.TrimSpace(raw))
	if status == "" {
		return "ACTIVE", true
	}
	if !programmeStatuses[status] {
		return "", false
	}
	return status, true
}

// programmeYearsError words the same range problem for admissions and courses.
func programmeYearsError(durationYears int) map[string]string {
	return map[string]string{
		"error": "this programme runs for " + strconv.Itoa(durationYears) +
			" years; pick a year of study inside that range",
	}
}

// registerAcademic wires the faculty/department/programme tree, the admissions
// that put students into a programme, and the assignment of courses to the
// programme that offers them.
func registerAcademic(mux *http.ServeMux, db *sql.DB) {
	mux.HandleFunc("GET /api/academic", getAcademicTree(db))

	mux.HandleFunc("POST /api/faculties", createFaculty(db))
	mux.HandleFunc("PATCH /api/faculties/{id}", patchFaculty(db))
	mux.HandleFunc("DELETE /api/faculties/{id}", deleteFaculty(db))

	mux.HandleFunc("POST /api/departments", createDepartment(db))
	mux.HandleFunc("PATCH /api/departments/{id}", patchDepartment(db))
	mux.HandleFunc("DELETE /api/departments/{id}", deleteDepartment(db))

	mux.HandleFunc("GET /api/programmes/{id}", getProgramme(db))
	mux.HandleFunc("POST /api/programmes", createProgramme(db))
	mux.HandleFunc("PATCH /api/programmes/{id}", patchProgramme(db))
	mux.HandleFunc("DELETE /api/programmes/{id}", deleteProgramme(db))

	mux.HandleFunc("POST /api/programmes/{id}/students", admitStudent(db))
	mux.HandleFunc("PATCH /api/programme-enrollments/{id}", patchAdmission(db))
	mux.HandleFunc("DELETE /api/programme-enrollments/{id}", deleteAdmission(db))

	mux.HandleFunc("POST /api/programmes/{id}/courses", assignCourse(db))
	mux.HandleFunc("DELETE /api/programmes/{id}/courses/{subjectId}", unassignCourse(db))
}

/* ---------- the tree ---------- */

// placement remembers where a department sits inside the response, so the
// programme pass can attach itself without scanning the tree again.
type placement struct {
	faculty    int
	department int
}

func getAcademicTree(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		out := academicOut{Faculties: []facultyOut{}}

		facultyRows, err := db.QueryContext(ctx,
			`SELECT id, name, COALESCE(code, '') FROM faculties ORDER BY name`)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		facultyIndex := map[string]int{}
		for facultyRows.Next() {
			var f facultyOut
			if err := facultyRows.Scan(&f.ID, &f.Name, &f.Code); err != nil {
				facultyRows.Close()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			f.Departments = []departmentOut{}
			facultyIndex[f.ID] = len(out.Faculties)
			out.Faculties = append(out.Faculties, f)
		}
		facultyRows.Close()

		departmentRows, err := db.QueryContext(ctx, `
			SELECT d.id, d.faculty_id, d.name, COALESCE(d.code, ''),
			       (SELECT COUNT(*) FROM programme_enrollments e
			          JOIN programmes p ON p.id = e.programme_id
			         WHERE p.department_id = d.id AND e.status = 'ACTIVE')
			FROM departments d ORDER BY d.name`)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		placements := map[string]placement{}
		for departmentRows.Next() {
			var d departmentOut
			if err := departmentRows.Scan(&d.ID, &d.FacultyID, &d.Name, &d.Code, &d.Students); err != nil {
				departmentRows.Close()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			facultyPosition, ok := facultyIndex[d.FacultyID]
			if !ok {
				continue // a department whose faculty vanished mid-query
			}
			d.Programmes = []programmeRowOut{}
			placements[d.ID] = placement{faculty: facultyPosition, department: len(out.Faculties[facultyPosition].Departments)}
			out.Faculties[facultyPosition].Departments = append(out.Faculties[facultyPosition].Departments, d)
			out.Faculties[facultyPosition].Students += d.Students
		}
		departmentRows.Close()

		programmeRows, err := db.QueryContext(ctx, `
			SELECT p.id, p.department_id, p.name, COALESCE(p.code, ''), p.level,
			       p.duration_years, COALESCE(p.total_ects, 0),
			       (SELECT COUNT(*) FROM subjects s WHERE s.programme_id = p.id),
			       (SELECT COUNT(*) FROM programme_enrollments e
			         WHERE e.programme_id = p.id AND e.status = 'ACTIVE')
			FROM programmes p ORDER BY p.name`)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		for programmeRows.Next() {
			var p programmeRowOut
			if err := programmeRows.Scan(&p.ID, &p.DepartmentID, &p.Name, &p.Code, &p.Level,
				&p.DurationYears, &p.TotalECTS, &p.Courses, &p.Students); err != nil {
				programmeRows.Close()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			at, ok := placements[p.DepartmentID]
			if !ok {
				continue
			}
			out.Faculties[at.faculty].Departments[at.department].Programmes =
				append(out.Faculties[at.faculty].Departments[at.department].Programmes, p)
		}
		programmeRows.Close()

		if err := db.QueryRowContext(ctx,
			`SELECT COUNT(*) FROM subjects WHERE programme_id IS NULL`).Scan(&out.UnassignedCourses); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if err := db.QueryRowContext(ctx, `
			SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id
			WHERE r.name = 'STUDENT'
			  AND NOT EXISTS (SELECT 1 FROM programme_enrollments e
			                   WHERE e.student_id = u.id AND e.status = 'ACTIVE')`).
			Scan(&out.UnplacedStudents); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, out)
	}
}

/* ---------- programmes ---------- */

func getProgramme(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		id := r.PathValue("id")

		detail := programmeDetailOut{
			Courses:  []programmeCourseOut{},
			Students: []programmeStudentOut{},
		}
		var programme programmeOut
		err := db.QueryRowContext(ctx, `
			SELECT p.id, p.department_id, p.name, COALESCE(p.code, ''), p.level,
			       p.duration_years, COALESCE(p.total_ects, 0), COALESCE(p.description, ''),
			       f.id, f.name, d.name,
			       (SELECT COUNT(*) FROM subjects s WHERE s.programme_id = p.id),
			       (SELECT COUNT(*) FROM programme_enrollments e
			         WHERE e.programme_id = p.id AND e.status = 'ACTIVE')
			FROM programmes p
			JOIN departments d ON d.id = p.department_id
			JOIN faculties f ON f.id = d.faculty_id
			WHERE p.id = ?`, id).
			Scan(&programme.ID, &programme.DepartmentID, &programme.Name, &programme.Code,
				&programme.Level, &programme.DurationYears, &programme.TotalECTS,
				&programme.Description, &programme.FacultyID, &programme.FacultyName,
				&programme.DepartmentName, &programme.Courses, &programme.Students)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "programme not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		detail.Programme = programme

		courseRows, err := db.QueryContext(ctx, `
			SELECT s.id, s.name, COALESCE(s.code, ''), COALESCE(u.name, ''),
			       COALESCE(s.ects, 0), s.semester, COALESCE(s.school_year, ''),
			       COALESCE(s.year_of_study, 0)
			FROM subjects s LEFT JOIN users u ON u.id = s.lecturer_id
			WHERE s.programme_id = ?
			ORDER BY COALESCE(s.year_of_study, 0), s.semester, s.name`, id)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		for courseRows.Next() {
			var c programmeCourseOut
			if err := courseRows.Scan(&c.ID, &c.Name, &c.Code, &c.LecturerName, &c.ECTS,
				&c.Semester, &c.SchoolYear, &c.YearOfStudy); err != nil {
				courseRows.Close()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			detail.Courses = append(detail.Courses, c)
		}
		courseRows.Close()

		studentRows, err := db.QueryContext(ctx, `
			SELECT e.id, u.id, u.name, u.email, COALESCE(e.school_year, ''),
			       e.year_of_study, e.status, e.enrolled_at
			FROM programme_enrollments e JOIN users u ON u.id = e.student_id
			WHERE e.programme_id = ?
			ORDER BY e.status = 'ACTIVE' DESC, e.year_of_study, u.name`, id)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		for studentRows.Next() {
			var s programmeStudentOut
			if err := studentRows.Scan(&s.EnrollmentID, &s.StudentID, &s.Name, &s.Email,
				&s.SchoolYear, &s.YearOfStudy, &s.Status, &s.EnrolledAt); err != nil {
				studentRows.Close()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			detail.Students = append(detail.Students, s)
		}
		studentRows.Close()

		writeJSON(w, http.StatusOK, detail)
	}
}

func createProgramme(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		var body struct {
			DepartmentID  string `json:"department_id"`
			Name          string `json:"name"`
			Code          string `json:"code"`
			Level         string `json:"level"`
			DurationYears int    `json:"duration_years"`
			TotalECTS     int    `json:"total_ects"`
			Description   string `json:"description"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		if strings.TrimSpace(body.Name) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name is required"})
			return
		}
		if body.DepartmentID == "" || !rowExists(ctx, db, "departments", body.DepartmentID) {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": "unknown department; pick the department that runs this programme",
			})
			return
		}
		level, ok := normaliseLevel(body.Level)
		if !ok {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "level must be BACHELOR, MASTER or DOCTORATE"})
			return
		}
		years := body.DurationYears
		if years == 0 {
			years = defaultYears(level)
		}
		if years < 1 || years > 8 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "duration must be between 1 and 8 years"})
			return
		}
		if body.TotalECTS < 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "total_ects cannot be negative"})
			return
		}

		id, now := util.NewID(), util.Now()
		if _, err := db.ExecContext(ctx, `
			INSERT INTO programmes (id, department_id, name, code, level, duration_years,
			                        total_ects, description, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			id, body.DepartmentID, strings.TrimSpace(body.Name), nullIfEmpty(body.Code),
			level, years, positiveOrNil(body.TotalECTS), body.Description, now, now); err != nil {
			if strings.Contains(err.Error(), "UNIQUE") {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "that programme already exists in this department"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusCreated, programmeRowOut{
			ID: id, DepartmentID: body.DepartmentID, Name: strings.TrimSpace(body.Name),
			Code: strings.TrimSpace(body.Code), Level: level,
			DurationYears: years, TotalECTS: body.TotalECTS,
		})
	}
}

func patchProgramme(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		id := r.PathValue("id")
		var body struct {
			DepartmentID  *string `json:"department_id"`
			Name          *string `json:"name"`
			Code          *string `json:"code"`
			Level         *string `json:"level"`
			DurationYears *int    `json:"duration_years"`
			TotalECTS     *int    `json:"total_ects"`
			Description   *string `json:"description"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		if !rowExists(ctx, db, "programmes", id) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "programme not found"})
			return
		}

		var b setBuilder
		if body.DepartmentID != nil {
			if !rowExists(ctx, db, "departments", *body.DepartmentID) {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown department"})
				return
			}
			b.set("department_id", *body.DepartmentID)
		}
		if body.Name != nil {
			name := strings.TrimSpace(*body.Name)
			if name == "" {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name cannot be empty"})
				return
			}
			b.set("name", name)
		}
		if body.Code != nil {
			b.set("code", nullIfEmpty(*body.Code))
		}
		if body.Level != nil {
			level, ok := normaliseLevel(*body.Level)
			if !ok {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "level must be BACHELOR, MASTER or DOCTORATE"})
				return
			}
			b.set("level", level)
		}
		if body.DurationYears != nil {
			if *body.DurationYears < 1 || *body.DurationYears > 8 {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "duration must be between 1 and 8 years"})
				return
			}
			b.set("duration_years", *body.DurationYears)
		}
		if body.TotalECTS != nil {
			if *body.TotalECTS < 0 {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "total_ects cannot be negative"})
				return
			}
			b.set("total_ects", positiveOrNil(*body.TotalECTS))
		}
		if body.Description != nil {
			b.set("description", *body.Description)
		}
		if b.empty() {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "nothing to update"})
			return
		}
		if _, err := b.updateRow(ctx, db, "programmes", id); err != nil {
			if strings.Contains(err.Error(), "UNIQUE") {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "that programme already exists in this department"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func deleteProgramme(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		id := r.PathValue("id")
		if !rowExists(ctx, db, "programmes", id) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "programme not found"})
			return
		}

		var courses, students int
		if err := db.QueryRowContext(ctx,
			`SELECT COUNT(*) FROM subjects WHERE programme_id = ?`, id).Scan(&courses); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if courses > 0 {
			writeJSON(w, http.StatusConflict, map[string]string{
				"error": "courses still belong to this programme; move them to another programme first",
			})
			return
		}
		if err := db.QueryRowContext(ctx,
			`SELECT COUNT(*) FROM programme_enrollments WHERE programme_id = ?`, id).Scan(&students); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if students > 0 {
			writeJSON(w, http.StatusConflict, map[string]string{
				"error": "students are still on this programme; remove their admissions first",
			})
			return
		}

		if _, err := db.ExecContext(ctx, `DELETE FROM programmes WHERE id = ?`, id); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

/* ---------- faculties ---------- */

func createFaculty(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Name string `json:"name"`
			Code string `json:"code"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		name := strings.TrimSpace(body.Name)
		if name == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name is required"})
			return
		}

		id, now := util.NewID(), util.Now()
		if _, err := db.ExecContext(r.Context(),
			`INSERT INTO faculties (id, name, code, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
			id, name, nullIfEmpty(body.Code), now, now); err != nil {
			if strings.Contains(err.Error(), "UNIQUE") {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "a faculty with that name or code already exists"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusCreated, facultyOut{
			ID: id, Name: name, Code: strings.TrimSpace(body.Code), Departments: []departmentOut{},
		})
	}
}

func patchFaculty(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		id := r.PathValue("id")
		var body struct {
			Name *string `json:"name"`
			Code *string `json:"code"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		if !rowExists(ctx, db, "faculties", id) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "faculty not found"})
			return
		}

		var b setBuilder
		if body.Name != nil {
			name := strings.TrimSpace(*body.Name)
			if name == "" {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name cannot be empty"})
				return
			}
			b.set("name", name)
		}
		if body.Code != nil {
			b.set("code", nullIfEmpty(*body.Code))
		}
		if b.empty() {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "nothing to update"})
			return
		}
		if _, err := b.updateRow(ctx, db, "faculties", id); err != nil {
			if strings.Contains(err.Error(), "UNIQUE") {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "a faculty with that name or code already exists"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func deleteFaculty(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		id := r.PathValue("id")
		if !rowExists(ctx, db, "faculties", id) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "faculty not found"})
			return
		}
		var departments int
		if err := db.QueryRowContext(ctx,
			`SELECT COUNT(*) FROM departments WHERE faculty_id = ?`, id).Scan(&departments); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if departments > 0 {
			writeJSON(w, http.StatusConflict, map[string]string{
				"error": "departments still belong to this faculty; move or remove them first",
			})
			return
		}
		if _, err := db.ExecContext(ctx, `DELETE FROM faculties WHERE id = ?`, id); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

/* ---------- departments ---------- */

func createDepartment(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		var body struct {
			FacultyID string `json:"faculty_id"`
			Name      string `json:"name"`
			Code      string `json:"code"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		name := strings.TrimSpace(body.Name)
		if name == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name is required"})
			return
		}
		if body.FacultyID == "" || !rowExists(ctx, db, "faculties", body.FacultyID) {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": "unknown faculty; pick the faculty this department belongs to",
			})
			return
		}

		id, now := util.NewID(), util.Now()
		if _, err := db.ExecContext(ctx, `
			INSERT INTO departments (id, faculty_id, name, code, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?)`,
			id, body.FacultyID, name, nullIfEmpty(body.Code), now, now); err != nil {
			if strings.Contains(err.Error(), "UNIQUE") {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "that department already exists in this faculty"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusCreated, departmentOut{
			ID: id, FacultyID: body.FacultyID, Name: name,
			Code: strings.TrimSpace(body.Code), Programmes: []programmeRowOut{},
		})
	}
}

func patchDepartment(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		id := r.PathValue("id")
		var body struct {
			FacultyID *string `json:"faculty_id"`
			Name      *string `json:"name"`
			Code      *string `json:"code"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		if !rowExists(ctx, db, "departments", id) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "department not found"})
			return
		}

		var b setBuilder
		if body.FacultyID != nil {
			if !rowExists(ctx, db, "faculties", *body.FacultyID) {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown faculty"})
				return
			}
			b.set("faculty_id", *body.FacultyID)
		}
		if body.Name != nil {
			name := strings.TrimSpace(*body.Name)
			if name == "" {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name cannot be empty"})
				return
			}
			b.set("name", name)
		}
		if body.Code != nil {
			b.set("code", nullIfEmpty(*body.Code))
		}
		if b.empty() {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "nothing to update"})
			return
		}
		if _, err := b.updateRow(ctx, db, "departments", id); err != nil {
			if strings.Contains(err.Error(), "UNIQUE") {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "that department already exists in this faculty"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func deleteDepartment(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		id := r.PathValue("id")
		if !rowExists(ctx, db, "departments", id) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "department not found"})
			return
		}
		var programmes int
		if err := db.QueryRowContext(ctx,
			`SELECT COUNT(*) FROM programmes WHERE department_id = ?`, id).Scan(&programmes); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if programmes > 0 {
			writeJSON(w, http.StatusConflict, map[string]string{
				"error": "programmes still belong to this department; move or remove them first",
			})
			return
		}
		if _, err := db.ExecContext(ctx, `DELETE FROM departments WHERE id = ?`, id); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

/* ---------- admissions: students in a programme ---------- */

func admitStudent(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		programmeID := r.PathValue("id")
		var body struct {
			StudentID   string `json:"student_id"`
			SchoolYear  string `json:"school_year"`
			YearOfStudy int    `json:"year_of_study"`
			Status      string `json:"status"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}

		var durationYears int
		err := db.QueryRowContext(ctx,
			`SELECT duration_years FROM programmes WHERE id = ?`, programmeID).Scan(&durationYears)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "programme not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		if body.StudentID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "student_id is required"})
			return
		}
		var studentName, studentEmail, studentRole string
		err = db.QueryRowContext(ctx, `
			SELECT u.name, u.email, r.name FROM users u JOIN roles r ON r.id = u.role_id
			WHERE u.id = ?`, body.StudentID).Scan(&studentName, &studentEmail, &studentRole)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown student"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if studentRole != "STUDENT" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "only student accounts can be admitted to a programme"})
			return
		}

		yearOfStudy := body.YearOfStudy
		if yearOfStudy == 0 {
			yearOfStudy = 1
		}
		if yearOfStudy < 1 || yearOfStudy > durationYears {
			writeJSON(w, http.StatusBadRequest, programmeYearsError(durationYears))
			return
		}
		status, ok := normaliseStatus(body.Status)
		if !ok {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "status must be ACTIVE, GRADUATED, SUSPENDED or WITHDRAWN"})
			return
		}
		schoolYear, err := resolveSchoolYear(ctx, db, body.SchoolYear)
		if err != nil {
			if err == errUnknownSchoolYear {
				writeJSON(w, http.StatusBadRequest, map[string]string{
					"error": "unknown school year; add it under School years first",
				})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		id, now := util.NewID(), util.Now()
		if _, err := db.ExecContext(ctx, `
			INSERT INTO programme_enrollments
			  (id, programme_id, student_id, school_year, year_of_study, status, enrolled_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			id, programmeID, body.StudentID, nullIfEmpty(schoolYear), yearOfStudy, status, now, now); err != nil {
			message := err.Error()
			if strings.Contains(message, "UNIQUE") {
				// Either this student is already on this programme, or another
				// admission is already active.
				var active int
				_ = db.QueryRowContext(ctx,
					`SELECT COUNT(*) FROM programme_enrollments WHERE student_id = ? AND status = 'ACTIVE'`,
					body.StudentID).Scan(&active)
				if active > 0 {
					writeJSON(w, http.StatusConflict, map[string]string{
						"error": "that student already follows a programme; end the current admission first",
					})
					return
				}
				writeJSON(w, http.StatusConflict, map[string]string{
					"error": "that student is already admitted to this programme",
				})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": message})
			return
		}

		if status == "ACTIVE" {
			if err := enrollInCurriculum(ctx, db, id); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
		}

		writeJSON(w, http.StatusCreated, programmeStudentOut{
			EnrollmentID: id, StudentID: body.StudentID, Name: studentName, Email: studentEmail,
			SchoolYear: schoolYear, YearOfStudy: yearOfStudy, Status: status, EnrolledAt: now,
		})
	}
}

func patchAdmission(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		id := r.PathValue("id")
		var body struct {
			SchoolYear  *string `json:"school_year"`
			YearOfStudy *int    `json:"year_of_study"`
			Status      *string `json:"status"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}

		var studentID string
		var durationYears int
		err := db.QueryRowContext(ctx, `
			SELECT e.student_id, p.duration_years
			FROM programme_enrollments e JOIN programmes p ON p.id = e.programme_id
			WHERE e.id = ?`, id).Scan(&studentID, &durationYears)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "admission not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		var b setBuilder
		if body.SchoolYear != nil {
			year, err := resolveSchoolYear(ctx, db, *body.SchoolYear)
			if err != nil {
				if err == errUnknownSchoolYear {
					writeJSON(w, http.StatusBadRequest, map[string]string{
						"error": "unknown school year; add it under School years first",
					})
					return
				}
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			b.set("school_year", nullIfEmpty(year))
		}
		if body.YearOfStudy != nil {
			if *body.YearOfStudy < 1 || *body.YearOfStudy > durationYears {
				writeJSON(w, http.StatusBadRequest, programmeYearsError(durationYears))
				return
			}
			b.set("year_of_study", *body.YearOfStudy)
		}
		if body.Status != nil {
			status, ok := normaliseStatus(*body.Status)
			if !ok {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "status must be ACTIVE, GRADUATED, SUSPENDED or WITHDRAWN"})
				return
			}
			// Only one admission is active at a time: ending one and starting
			// another is two writes, in that order.
			if status == "ACTIVE" {
				var otherActive int
				if err := db.QueryRowContext(ctx, `
					SELECT COUNT(*) FROM programme_enrollments
					WHERE student_id = ? AND status = 'ACTIVE' AND id <> ?`, studentID, id).Scan(&otherActive); err != nil {
					writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
					return
				}
				if otherActive > 0 {
					writeJSON(w, http.StatusConflict, map[string]string{
						"error": "that student already follows another programme; end that admission first",
					})
					return
				}
			}
			b.set("status", status)
		}
		if b.empty() {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "nothing to update"})
			return
		}
		if _, err := b.updateRow(ctx, db, "programme_enrollments", id); err != nil {
			if strings.Contains(err.Error(), "UNIQUE") {
				writeJSON(w, http.StatusConflict, map[string]string{
					"error": "that student already follows a programme; end the current admission first",
				})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if err := enrollInCurriculum(ctx, db, id); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func deleteAdmission(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		res, err := db.ExecContext(r.Context(),
			`DELETE FROM programme_enrollments WHERE id = ?`, r.PathValue("id"))
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "admission not found"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

/* ---------- courses belong to a programme ---------- */

func assignCourse(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		programmeID := r.PathValue("id")
		var body struct {
			SubjectID   string `json:"subject_id"`
			YearOfStudy int    `json:"year_of_study"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}

		var durationYears int
		err := db.QueryRowContext(ctx,
			`SELECT duration_years FROM programmes WHERE id = ?`, programmeID).Scan(&durationYears)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "programme not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if body.SubjectID == "" || !rowExists(ctx, db, "subjects", body.SubjectID) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown course"})
			return
		}
		yearOfStudy := body.YearOfStudy
		if yearOfStudy == 0 {
			yearOfStudy = 1
		}
		if yearOfStudy < 1 || yearOfStudy > durationYears {
			writeJSON(w, http.StatusBadRequest, programmeYearsError(durationYears))
			return
		}

		if _, err := db.ExecContext(ctx, `
			UPDATE subjects SET programme_id = ?, year_of_study = ?, updated_at = ? WHERE id = ?`,
			programmeID, yearOfStudy, util.Now(), body.SubjectID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if err := enrollProgrammeStudents(r.Context(), db, body.SubjectID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func unassignCourse(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		res, err := db.ExecContext(r.Context(), `
			UPDATE subjects SET programme_id = NULL, year_of_study = NULL, updated_at = ?
			WHERE id = ? AND programme_id = ?`,
			util.Now(), r.PathValue("subjectId"), r.PathValue("id"))
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "course not found on this programme"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

/* ---------- small helpers ---------- */

// positiveOrNil stores an unset (0) numeric field as NULL rather than zero.
func positiveOrNil(v int) any {
	if v <= 0 {
		return nil
	}
	return v
}

// enrollInCurriculum enrols the student of an active admission in every subject
// of their programme for their current year of study, so admitting a student
// (or moving them up a year) gives them their subjects. Subjects they already
// sit in are kept, and nothing is removed.
func enrollInCurriculum(ctx context.Context, db *sql.DB, admissionID string) error {
	_, err := db.ExecContext(ctx, `
		INSERT INTO enrollments (id, student_id, subject_id, enrolled_at)
		SELECT lower(hex(randomblob(16))), e.student_id, s.id, ?
		FROM programme_enrollments e
		JOIN subjects s ON s.programme_id = e.programme_id AND s.year_of_study = e.year_of_study
		WHERE e.id = ? AND e.status = 'ACTIVE'
		ON CONFLICT (student_id, subject_id) DO NOTHING`, util.Now(), admissionID)
	if err != nil {
		return fmt.Errorf("enrol in curriculum: %w", err)
	}
	return nil
}

// enrollProgrammeStudents enrols every student actively admitted to a
// subject's programme, in the subject's year of study, in that subject. It runs
// whenever a subject is placed in a programme, so adding a subject to a field
// gives its students the subject. A subject without a programme or year is a
// no-op, and existing enrolments are kept.
func enrollProgrammeStudents(ctx context.Context, db *sql.DB, subjectID string) error {
	_, err := db.ExecContext(ctx, `
		INSERT INTO enrollments (id, student_id, subject_id, enrolled_at)
		SELECT lower(hex(randomblob(16))), e.student_id, s.id, ?
		FROM subjects s
		JOIN programme_enrollments e ON e.programme_id = s.programme_id
		     AND e.year_of_study = s.year_of_study AND e.status = 'ACTIVE'
		WHERE s.id = ?
		ON CONFLICT (student_id, subject_id) DO NOTHING`, util.Now(), subjectID)
	if err != nil {
		return fmt.Errorf("enrol programme students: %w", err)
	}
	return nil
}
