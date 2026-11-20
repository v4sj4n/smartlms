package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"optimolms/backend/internal/util"
)

type lectureOut struct {
	ID          string          `json:"id"`
	Title       string          `json:"title"`
	Description string          `json:"description,omitempty"`
	ClassID     string          `json:"class_id,omitempty"`
	ClassName   string          `json:"class_name,omitempty"`
	ScheduledAt string          `json:"scheduled_at,omitempty"`
	WeekID      string          `json:"week_id,omitempty"`
	File        *lectureFileOut `json:"file,omitempty"`
}

// assignmentOut carries what a student needs to see on the assignment list:
// when it is due, how it is submitted and what it is worth.
type assignmentOut struct {
	ID             string `json:"id"`
	Title          string `json:"title"`
	Description    string `json:"description,omitempty"`
	ClassID        string `json:"class_id,omitempty"`
	ClassName      string `json:"class_name,omitempty"`
	ScheduledAt    string `json:"scheduled_at,omitempty"`
	DueAt          string `json:"due_at,omitempty"`
	MaxPoints      int    `json:"max_points"`
	AllowLate      bool   `json:"allow_late"`
	SubmissionType string `json:"submission_type"`
	IsPublished    bool   `json:"is_published"`
	WeekID         string `json:"week_id,omitempty"`
}

type quizOut struct {
	ID               string `json:"id"`
	Title            string `json:"title"`
	Description      string `json:"description,omitempty"`
	TimeLimitMinutes int    `json:"time_limit_minutes,omitempty"`
	QuestionCount    int    `json:"question_count"`
	WeekID           string `json:"week_id,omitempty"`
}

type subjectOut struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	Code         string  `json:"code,omitempty"`
	Description  string  `json:"description,omitempty"`
	LecturerID   string  `json:"lecturer_id,omitempty"`
	LecturerName string  `json:"lecturer_name,omitempty"`
	ECTS         float64 `json:"ects,omitempty"`
	Semester     string  `json:"semester"`
	SchoolYear   string  `json:"school_year,omitempty"`
	// The programme that offers this course, and the year of that programme it
	// is taught in. Empty until an administrator assigns it.
	ProgrammeID   string `json:"programme_id,omitempty"`
	ProgrammeName string `json:"programme_name,omitempty"`
	YearOfStudy   int    `json:"year_of_study,omitempty"`
	Counts        struct {
		Lectures      int `json:"lectures"`
		Assignments   int `json:"assignments"`
		Quizzes       int `json:"quizzes"`
		FlashcardSets int `json:"flashcard_sets"`
	} `json:"counts"`
}

type subjectDetailOut struct {
	subjectOut
	Lectures      []lectureOut      `json:"lectures"`
	Assignments   []assignmentOut   `json:"assignments"`
	Quizzes       []quizOut         `json:"quizzes"`
	FlashcardSets []flashcardSetOut `json:"flashcard_sets"`
}

// registerSubjects wires course CRUD plus the content that lives inside a
// course: lectures, seminars, quizzes and flashcards.
func registerSubjects(mux *http.ServeMux, db *sql.DB) {
	mux.HandleFunc("GET /api/subjects", listSubjects(db))
	mux.HandleFunc("GET /api/subjects/{id}", getSubject(db))
	mux.HandleFunc("POST /api/subjects", createSubject(db))
	mux.HandleFunc("PATCH /api/subjects/{id}", patchSubject(db))
	mux.HandleFunc("DELETE /api/subjects/{id}", deleteSubject(db))

	mux.HandleFunc("POST /api/subjects/{id}/lectures", createLecture(db))
	mux.HandleFunc("PATCH /api/lectures/{id}", patchLecture(db, "lectures"))
	mux.HandleFunc("DELETE /api/lectures/{id}", deleteByID(db, "lectures"))

	mux.HandleFunc("POST /api/subjects/{id}/assignments", createAssignment(db))
	mux.HandleFunc("PATCH /api/assignments/{id}", patchAssignment(db))
	mux.HandleFunc("DELETE /api/assignments/{id}", deleteByID(db, "assignments"))

	mux.HandleFunc("POST /api/subjects/{id}/quizzes", createQuiz(db))
	mux.HandleFunc("PATCH /api/quizzes/{id}", patchQuiz(db))
	mux.HandleFunc("DELETE /api/quizzes/{id}", deleteByID(db, "quizzes"))

	mux.HandleFunc("POST /api/subjects/{id}/flashcard-sets", createFlashcardSet(db))
	mux.HandleFunc("PATCH /api/flashcard-sets/{id}", patchFlashcardSet(db))
	mux.HandleFunc("DELETE /api/flashcard-sets/{id}", deleteByID(db, "flashcard_sets"))
}

/* ---------- shared update helper ---------- */

type setBuilder struct {
	sets []string
	args []any
}

func (b *setBuilder) set(col string, v any) {
	b.sets = append(b.sets, col+" = ?")
	b.args = append(b.args, v)
}

func (b *setBuilder) empty() bool { return len(b.sets) == 0 }

// updateRow applies the builder's SET clause to table/id. Tables are internal
// constants, never user input.
func (b *setBuilder) updateRow(ctx context.Context, db *sql.DB, table, id string) (bool, error) {
	b.set("updated_at", util.Now())
	b.args = append(b.args, id)
	res, err := db.ExecContext(ctx, fmt.Sprintf(`UPDATE %s SET %s WHERE id = ?`, table, strings.Join(b.sets, ", ")), b.args...)
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	return n > 0, err
}

func deleteByID(db *sql.DB, table string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		res, err := db.ExecContext(r.Context(), fmt.Sprintf(`DELETE FROM %s WHERE id = ?`, table), r.PathValue("id"))
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func rowExists(ctx context.Context, db *sql.DB, table, id string) bool {
	var n int
	if err := db.QueryRowContext(ctx, fmt.Sprintf(`SELECT COUNT(*) FROM %s WHERE id = ?`, table), id).Scan(&n); err != nil {
		return false
	}
	return n > 0
}

/* ---------- subjects ---------- */

const subjectSelect = `
	SELECT c.id, c.name, COALESCE(c.code, ''), COALESCE(c.description, ''),
	       COALESCE(c.lecturer_id, ''), COALESCE(u.name, ''),
	       COALESCE(c.ects, 0), c.semester, COALESCE(c.school_year, ''),
	       COALESCE(c.programme_id, ''), COALESCE(p.name, ''), COALESCE(c.year_of_study, 0),
	       (SELECT COUNT(*) FROM lectures   x WHERE x.subject_id = c.id),
	       (SELECT COUNT(*) FROM assignments x WHERE x.subject_id = c.id),
	       (SELECT COUNT(*) FROM quizzes    x WHERE x.subject_id = c.id),
	       (SELECT COUNT(*) FROM flashcard_sets x WHERE x.subject_id = c.id)
	FROM subjects c
	LEFT JOIN users u ON u.id = c.lecturer_id
	LEFT JOIN programmes p ON p.id = c.programme_id`

func scanSubject(row interface{ Scan(...any) error }) (subjectOut, error) {
	var c subjectOut
	err := row.Scan(&c.ID, &c.Name, &c.Code, &c.Description,
		&c.LecturerID, &c.LecturerName, &c.ECTS, &c.Semester, &c.SchoolYear,
		&c.ProgrammeID, &c.ProgrammeName, &c.YearOfStudy,
		&c.Counts.Lectures, &c.Counts.Assignments, &c.Counts.Quizzes, &c.Counts.FlashcardSets)
	return c, err
}

// programmeDuration returns how many years a programme runs, and whether it
// exists at all.
func programmeDuration(ctx context.Context, db *sql.DB, id string) (int, bool) {
	var years int
	if err := db.QueryRowContext(ctx,
		`SELECT duration_years FROM programmes WHERE id = ?`, id).Scan(&years); err != nil {
		return 0, false
	}
	return years, true
}

// resolveCourseProgramme validates the programme/year pair a course is filed
// under. An empty programme clears both fields.
func resolveCourseProgramme(ctx context.Context, db *sql.DB, programmeID string, yearOfStudy int) (string, int, string) {
	programmeID = strings.TrimSpace(programmeID)
	if programmeID == "" {
		return "", 0, ""
	}
	years, ok := programmeDuration(ctx, db, programmeID)
	if !ok {
		return "", 0, "unknown programme; pick one from the academic structure"
	}
	if yearOfStudy == 0 {
		yearOfStudy = 1
	}
	if yearOfStudy < 1 || yearOfStudy > years {
		return "", 0, "this programme runs for " + strconv.Itoa(years) + " years; pick a year inside that range"
	}
	return programmeID, yearOfStudy, ""
}

// subjectStaff reports whether the caller runs a subject: an administrator, or
// the lecturer the subject records as its own. That is what "staff" means for
// the catalogue — holding subjects.view is not the same thing, because every
// student holds it too.
func subjectStaff(ctx context.Context, db *sql.DB, user *caller, subjectID string) (bool, error) {
	if user.isAdmin() {
		return true, nil
	}
	if user.ID == "" {
		return false, nil
	}
	var n int
	if err := db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM subjects WHERE id = ? AND lecturer_id = ?`, subjectID, user.ID).Scan(&n); err != nil {
		return false, err
	}
	return n > 0, nil
}

// callerSeesSubject is the read rule of the catalogue: staff see every subject,
// everybody else only the subjects they are enrolled in. A request that carries
// no identity at all never reached the session middleware (a test driving the
// mux directly), and keeps the wide answer.
func callerSeesSubject(ctx context.Context, db *sql.DB, user *caller, subjectID string) (bool, error) {
	if user.ID == "" {
		return true, nil
	}
	staff, err := subjectStaff(ctx, db, user, subjectID)
	if err != nil || staff {
		return staff, err
	}
	var n int
	if err := db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM enrollments WHERE subject_id = ? AND student_id = ?`,
		subjectID, user.ID).Scan(&n); err != nil {
		return false, err
	}
	return n > 0, nil
}

func listSubjects(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		page, size := pagination(r)
		user := callerFrom(r)

		// ?school_year=2026/2027 narrows the list to one academic year, the way
		// the subjects screen's year filter asks for it.
		conditions, args := []string{}, []any{}
		if year := strings.TrimSpace(r.URL.Query().Get("school_year")); year != "" {
			conditions = append(conditions, `c.school_year = ?`)
			args = append(args, year)
		}
		// A caller who does not run the catalogue only sees their own subjects:
		// the ones they teach, and the ones they are enrolled in. Counts below
		// are unaffected — they count the content of a row, not rows.
		if user.ID != "" && !user.isAdmin() {
			conditions = append(conditions,
				`(c.lecturer_id = ? OR EXISTS (SELECT 1 FROM enrollments e WHERE e.subject_id = c.id AND e.student_id = ?))`)
			args = append(args, user.ID, user.ID)
		}
		where := ""
		if len(conditions) > 0 {
			where = ` WHERE ` + strings.Join(conditions, ` AND `)
		}

		var total int
		if err := db.QueryRowContext(r.Context(),
			`SELECT COUNT(*) FROM subjects c`+where, args...).Scan(&total); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		pageArgs := append(append([]any{}, args...), size, offset(page, size))
		rows, err := db.QueryContext(r.Context(), subjectSelect+where+` ORDER BY c.name LIMIT ? OFFSET ?`, pageArgs...)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()
		subjects := []subjectOut{}
		for rows.Next() {
			c, err := scanSubject(rows)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			subjects = append(subjects, c)
		}
		writeJSON(w, http.StatusOK, pageOut{Items: subjects, Total: total, Page: page, PageSize: size})
	}
}

func getSubject(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		id := r.PathValue("id")

		c, err := scanSubject(db.QueryRowContext(ctx, subjectSelect+` WHERE c.id = ?`, id))
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "subject not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		// The detail is the subject's whole content, so it is only for the
		// people the list would show it to. 403 rather than 404: the subject
		// exists, this caller does not study it.
		visible, err := callerSeesSubject(ctx, db, callerFrom(r), id)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if !visible {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "you are not enrolled in this subject"})
			return
		}

		detail := subjectDetailOut{
			subjectOut:    c,
			Lectures:      []lectureOut{},
			Assignments:   []assignmentOut{},
			Quizzes:       []quizOut{},
			FlashcardSets: []flashcardSetOut{},
		}

		lectureRows, err := db.QueryContext(ctx, `
			SELECT x.id, x.title, COALESCE(x.description, ''), COALESCE(x.class_id, ''),
			       COALESCE(cl.name, ''), COALESCE(x.scheduled_at, ''), COALESCE(x.week_id, ''),
			       f.file_name, f.content_type, f.size, f.uploaded_at
			FROM lectures x LEFT JOIN classes cl ON cl.id = x.class_id
			LEFT JOIN lecture_files f ON f.lecture_id = x.id
			WHERE x.subject_id = ? ORDER BY x.scheduled_at, x.title`, id)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		for lectureRows.Next() {
			var l lectureOut
			var fileName, fileType, fileUploaded sql.NullString
			var fileSize sql.NullInt64
			if err := lectureRows.Scan(&l.ID, &l.Title, &l.Description, &l.ClassID, &l.ClassName, &l.ScheduledAt, &l.WeekID,
				&fileName, &fileType, &fileSize, &fileUploaded); err != nil {
				lectureRows.Close()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			if fileName.Valid {
				l.File = &lectureFileOut{
					Name: fileName.String, Type: lectureFileType(fileType.String),
					Size: fileSize.Int64, UploadedAt: fileUploaded.String,
				}
			}
			detail.Lectures = append(detail.Lectures, l)
		}
		lectureRows.Close()

		assignmentRows, err := db.QueryContext(ctx, assignmentSelect+` WHERE a.subject_id = ? ORDER BY a.due_at IS NULL, a.due_at, a.title`, id)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		for assignmentRows.Next() {
			a, err := scanAssignment(assignmentRows)
			if err != nil {
				assignmentRows.Close()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			detail.Assignments = append(detail.Assignments, a)
		}
		assignmentRows.Close()

		quizRows, err := db.QueryContext(ctx, `
			SELECT q.id, q.title, COALESCE(q.description, ''), COALESCE(q.time_limit_minutes, 0),
			       (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id),
			       COALESCE(q.week_id, '')
			FROM quizzes q WHERE q.subject_id = ? ORDER BY q.title`, id)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		for quizRows.Next() {
			var q quizOut
			if err := quizRows.Scan(&q.ID, &q.Title, &q.Description, &q.TimeLimitMinutes, &q.QuestionCount, &q.WeekID); err != nil {
				quizRows.Close()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			detail.Quizzes = append(detail.Quizzes, q)
		}
		quizRows.Close()

		sets, err := loadFlashcardSets(ctx, db, id)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		detail.FlashcardSets = sets

		writeJSON(w, http.StatusOK, detail)
	}
}

func createSubject(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Name        string  `json:"name"`
			Code        string  `json:"code"`
			Description string  `json:"description"`
			LecturerID  string  `json:"lecturer_id"`
			ECTS        float64 `json:"ects"`
			Semester    string  `json:"semester"`
			SchoolYear  string  `json:"school_year"`
			ProgrammeID string  `json:"programme_id"`
			YearOfStudy int     `json:"year_of_study"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		if strings.TrimSpace(body.Name) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name is required"})
			return
		}
		id, now := util.NewID(), util.Now()
		var code any
		if strings.TrimSpace(body.Code) != "" {
			code = strings.TrimSpace(body.Code)
		}
		var lecturerID any
		if body.LecturerID != "" {
			lecturerID = body.LecturerID
		}
		semester := strings.ToUpper(strings.TrimSpace(body.Semester))
		if semester != "SECOND" {
			semester = "FIRST"
		}
		var ects any
		if body.ECTS > 0 {
			ects = body.ECTS
		}
		// An unset year inherits the current one; a named year must exist in the
		// catalog, so subjects never drift into a year nobody can find again.
		schoolYear, err := resolveSchoolYear(r.Context(), db, body.SchoolYear)
		if err != nil {
			if errors.Is(err, errUnknownSchoolYear) {
				writeJSON(w, http.StatusBadRequest, map[string]string{
					"error": "unknown school year; add it under School years first",
				})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		// A course belongs to the programme that offers it; both the programme
		// and the year of study are optional, so a course can be drafted first.
		programmeID, yearOfStudy, problem := resolveCourseProgramme(r.Context(), db, body.ProgrammeID, body.YearOfStudy)
		if problem != "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": problem})
			return
		}
		_, err = db.ExecContext(r.Context(),
			`INSERT INTO subjects (id, name, code, description, lecturer_id, ects, semester, school_year,
			                       programme_id, year_of_study, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			id, strings.TrimSpace(body.Name), code, body.Description, lecturerID, ects, semester,
			nullIfEmpty(schoolYear), nullIfEmpty(programmeID), positiveOrNil(yearOfStudy), now, now)
		if err != nil {
			if strings.Contains(err.Error(), "UNIQUE") {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "a subject with that code already exists"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if err := enrollProgrammeStudents(r.Context(), db, id); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusCreated, map[string]string{"id": id})
	}
}

func patchSubject(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Name        *string  `json:"name"`
			Code        *string  `json:"code"`
			Description *string  `json:"description"`
			LecturerID  *string  `json:"lecturer_id"`
			ECTS        *float64 `json:"ects"`
			Semester    *string  `json:"semester"`
			SchoolYear  *string  `json:"school_year"`
			ProgrammeID *string  `json:"programme_id"`
			YearOfStudy *int     `json:"year_of_study"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		var b setBuilder
		if body.Name != nil {
			if strings.TrimSpace(*body.Name) == "" {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name cannot be empty"})
				return
			}
			b.set("name", strings.TrimSpace(*body.Name))
		}
		if body.Code != nil {
			code := strings.TrimSpace(*body.Code)
			if code == "" {
				b.set("code", nil)
			} else {
				b.set("code", code)
			}
		}
		if body.Description != nil {
			b.set("description", *body.Description)
		}
		if body.LecturerID != nil {
			b.set("lecturer_id", nullIfEmpty(*body.LecturerID))
		}
		if body.ECTS != nil {
			b.set("ects", *body.ECTS)
		}
		if body.Semester != nil {
			semester := strings.ToUpper(strings.TrimSpace(*body.Semester))
			if semester != "SECOND" {
				semester = "FIRST"
			}
			b.set("semester", semester)
		}
		if body.SchoolYear != nil {
			year := strings.TrimSpace(*body.SchoolYear)
			if year != "" {
				exists, err := schoolYearExists(r.Context(), db, year)
				if err != nil {
					writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
					return
				}
				if !exists {
					writeJSON(w, http.StatusBadRequest, map[string]string{
						"error": "unknown school year; add it under School years first",
					})
					return
				}
			}
			b.set("school_year", nullIfEmpty(year))
		}
		if body.ProgrammeID != nil || body.YearOfStudy != nil {
			var current sql.NullString
			var currentYear sql.NullInt64
			if err := db.QueryRowContext(r.Context(),
				`SELECT programme_id, year_of_study FROM subjects WHERE id = ?`, r.PathValue("id")).
				Scan(&current, &currentYear); err != nil {
				if err == sql.ErrNoRows {
					writeJSON(w, http.StatusNotFound, map[string]string{"error": "subject not found"})
					return
				}
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}

			programmeID := current.String
			if body.ProgrammeID != nil {
				programmeID = strings.TrimSpace(*body.ProgrammeID)
			}
			if programmeID == "" {
				// Leaving a programme clears the year of study with it: a year
				// means nothing without the programme that defines its length.
				b.set("programme_id", nil)
				b.set("year_of_study", nil)
			} else {
				years, ok := programmeDuration(r.Context(), db, programmeID)
				if !ok {
					writeJSON(w, http.StatusBadRequest, map[string]string{
						"error": "unknown programme; pick one from the academic structure",
					})
					return
				}
				year := int(currentYear.Int64)
				if body.YearOfStudy != nil {
					year = *body.YearOfStudy
				}
				if year == 0 {
					year = 1
				}
				if year < 1 || year > years {
					writeJSON(w, http.StatusBadRequest, map[string]string{
						"error": "this programme runs for " + strconv.Itoa(years) + " years; pick a year inside that range",
					})
					return
				}
				b.set("programme_id", programmeID)
				// Keep the existing year when only the programme is mentioned.
				if body.YearOfStudy != nil || programmeID != current.String {
					b.set("year_of_study", year)
				}
			}
		}
		if b.empty() {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "nothing to update"})
			return
		}
		found, err := b.updateRow(r.Context(), db, "subjects", r.PathValue("id"))
		if err != nil {
			if strings.Contains(err.Error(), "UNIQUE") {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "a subject with that code already exists"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if !found {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "subject not found"})
			return
		}
		if err := enrollProgrammeStudents(r.Context(), db, r.PathValue("id")); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func deleteSubject(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		res, err := db.ExecContext(r.Context(), `DELETE FROM subjects WHERE id = ?`, r.PathValue("id"))
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "subject not found"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func nullIfEmpty(s string) any {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return strings.TrimSpace(s)
}

/* ---------- lectures & seminars ---------- */

type sessionBody struct {
	Title       string  `json:"title"`
	Description string  `json:"description"`
	ClassID     string  `json:"class_id"`
	ScheduledAt *string `json:"scheduled_at"`
	WeekID      string  `json:"week_id"`
}

func createSession(db *sql.DB, table string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		subjectID := r.PathValue("id")
		var body sessionBody
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		if strings.TrimSpace(body.Title) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "title is required"})
			return
		}
		if !rowExists(r.Context(), db, "subjects", subjectID) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "subject not found"})
			return
		}
		id, now := util.NewID(), util.Now()
		var scheduled any
		if body.ScheduledAt != nil && strings.TrimSpace(*body.ScheduledAt) != "" {
			scheduled = *body.ScheduledAt
		}
		weekID, problem := weekPlacement(r.Context(), db, subjectID, body.WeekID)
		if problem != "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": problem})
			return
		}
		_, err := db.ExecContext(r.Context(), fmt.Sprintf(`
			INSERT INTO %s (id, subject_id, class_id, title, description, scheduled_at, week_id, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, table),
			id, subjectID, nullIfEmpty(body.ClassID), strings.TrimSpace(body.Title), body.Description, scheduled, weekID, now, now)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusCreated, lectureOut{
			ID: id, Title: strings.TrimSpace(body.Title), Description: body.Description,
			ClassID: body.ClassID, WeekID: strings.TrimSpace(body.WeekID),
		})
	}
}

func createLecture(db *sql.DB) http.HandlerFunc { return createSession(db, "lectures") }

func patchLecture(db *sql.DB, table string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Title       *string `json:"title"`
			Description *string `json:"description"`
			ClassID     *string `json:"class_id"`
			ScheduledAt *string `json:"scheduled_at"`
			WeekID      *string `json:"week_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		var b setBuilder
		if body.Title != nil {
			if strings.TrimSpace(*body.Title) == "" {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "title cannot be empty"})
				return
			}
			b.set("title", strings.TrimSpace(*body.Title))
		}
		if body.Description != nil {
			b.set("description", *body.Description)
		}
		if body.ClassID != nil {
			b.set("class_id", nullIfEmpty(*body.ClassID))
		}
		if body.ScheduledAt != nil {
			b.set("scheduled_at", nullIfEmpty(*body.ScheduledAt))
		}
		if body.WeekID != nil {
			subjectID, ok := subjectOf(r.Context(), db, table, r.PathValue("id"))
			if !ok {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
				return
			}
			weekID, problem := weekPlacement(r.Context(), db, subjectID, *body.WeekID)
			if problem != "" {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": problem})
				return
			}
			b.set("week_id", weekID)
		}
		if b.empty() {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "nothing to update"})
			return
		}
		found, err := b.updateRow(r.Context(), db, table, r.PathValue("id"))
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if !found {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

/* ---------- quizzes ---------- */

func createQuiz(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		subjectID := r.PathValue("id")
		var body struct {
			Title            string `json:"title"`
			Description      string `json:"description"`
			TimeLimitMinutes int    `json:"time_limit_minutes"`
			WeekID           string `json:"week_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		if strings.TrimSpace(body.Title) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "title is required"})
			return
		}
		if !rowExists(r.Context(), db, "subjects", subjectID) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "subject not found"})
			return
		}
		id, now := util.NewID(), util.Now()
		weekID, problem := weekPlacement(r.Context(), db, subjectID, body.WeekID)
		if problem != "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": problem})
			return
		}
		if _, err := db.ExecContext(r.Context(),
			`INSERT INTO quizzes (id, subject_id, title, description, time_limit_minutes, week_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			id, subjectID, strings.TrimSpace(body.Title), body.Description, body.TimeLimitMinutes, weekID, now, now); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusCreated, quizOut{
			ID: id, Title: strings.TrimSpace(body.Title), Description: body.Description,
			TimeLimitMinutes: body.TimeLimitMinutes, WeekID: strings.TrimSpace(body.WeekID),
		})
	}
}

func patchQuiz(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Title            *string `json:"title"`
			Description      *string `json:"description"`
			TimeLimitMinutes *int    `json:"time_limit_minutes"`
			WeekID           *string `json:"week_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		var b setBuilder
		if body.Title != nil {
			if strings.TrimSpace(*body.Title) == "" {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "title cannot be empty"})
				return
			}
			b.set("title", strings.TrimSpace(*body.Title))
		}
		if body.Description != nil {
			b.set("description", *body.Description)
		}
		if body.TimeLimitMinutes != nil {
			if *body.TimeLimitMinutes < 0 {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "time limit cannot be negative"})
				return
			}
			b.set("time_limit_minutes", *body.TimeLimitMinutes)
		}
		if body.WeekID != nil {
			subjectID, ok := subjectOf(r.Context(), db, "quizzes", r.PathValue("id"))
			if !ok {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "quiz not found"})
				return
			}
			weekID, problem := weekPlacement(r.Context(), db, subjectID, *body.WeekID)
			if problem != "" {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": problem})
				return
			}
			b.set("week_id", weekID)
		}
		if b.empty() {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "nothing to update"})
			return
		}
		found, err := b.updateRow(r.Context(), db, "quizzes", r.PathValue("id"))
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if !found {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "quiz not found"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
