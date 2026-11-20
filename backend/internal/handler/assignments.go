package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"optimolms/backend/internal/util"
)

/* ============================================================================
   ASSIGNMENTS
   Seminars and assignments are the same thing: a scheduled session the student
   has to hand something in for. The legacy LMS calls them seminars, students
   call them assignments, so the table and the API use "assignments".
   ========================================================================== */

const assignmentSelect = `
	SELECT a.id, a.title, COALESCE(a.description, ''), COALESCE(a.class_id, ''),
	       COALESCE(cl.name, ''), COALESCE(a.scheduled_at, ''), COALESCE(a.due_at, ''),
	       a.max_points, a.allow_late, a.submission_type, a.is_published, COALESCE(a.week_id, '')
	FROM assignments a
	LEFT JOIN classes cl ON cl.id = a.class_id`

func scanAssignment(row interface{ Scan(...any) error }) (assignmentOut, error) {
	var a assignmentOut
	err := row.Scan(&a.ID, &a.Title, &a.Description, &a.ClassID, &a.ClassName,
		&a.ScheduledAt, &a.DueAt, &a.MaxPoints, &a.AllowLate, &a.SubmissionType, &a.IsPublished,
		&a.WeekID)
	return a, err
}

// assignmentListOut is the row of the student's cross-subject assignment list.
type assignmentListOut struct {
	assignmentOut
	SubjectID   string   `json:"subject_id"`
	SubjectName string   `json:"subject_name"`
	StatusCode  string   `json:"status"` // todo | overdue | submitted | late | graded
	Score       *float64 `json:"score"`
	Feedback    string   `json:"feedback,omitempty"`
	SubmittedAt string   `json:"submitted_at,omitempty"`
}

// submissionOut is one handed-in assignment. The file summary is three nullable
// fields — name, kind and size — and never the bytes: those live behind
// GET /api/submissions/{id}/file (see submission_files.go).
type submissionOut struct {
	ID           string   `json:"id"`
	AssignmentID string   `json:"assignment_id"`
	StudentID    string   `json:"student_id"`
	StudentName  string   `json:"student_name,omitempty"`
	Content      string   `json:"content,omitempty"`
	FileURL      string   `json:"file_url,omitempty"`
	FileName     *string  `json:"file_name"`
	FileKind     *string  `json:"file_kind"`
	FileSize     *int64   `json:"file_size"`
	Status       string   `json:"status"`
	Score        *float64 `json:"score"`
	MaxPoints    int      `json:"max_points"`
	Feedback     string   `json:"feedback,omitempty"`
	SubmittedAt  string   `json:"submitted_at"`
	GradedAt     string   `json:"graded_at,omitempty"`
}

// submissionSelect is the shared column list behind every submission payload:
// the row, the assignment's point ceiling, the student's name, and the summary of
// the stored file when there is one. Callers add their own WHERE and ORDER BY.
const submissionSelect = `
	SELECT sub.id, sub.assignment_id, sub.student_id, COALESCE(u.name, ''),
	       COALESCE(sub.content, ''), COALESCE(sub.file_url, ''), sub.status,
	       sub.score, a.max_points, COALESCE(sub.feedback, ''), sub.submitted_at,
	       COALESCE(sub.graded_at, ''),
	       sf.file_name, sf.file_kind, sf.file_size
	FROM assignment_submissions sub
	JOIN assignments a ON a.id = sub.assignment_id
	LEFT JOIN users u ON u.id = sub.student_id
	LEFT JOIN submission_files sf ON sf.submission_id = sub.id`

func registerAssignments(mux *http.ServeMux, db *sql.DB) {
	// Student view: every assignment across the subjects they are enrolled in.
	mux.HandleFunc("GET /api/assignments", listAssignmentsForStudent(db))
	mux.HandleFunc("GET /api/assignments/{id}", getAssignment(db))
	mux.HandleFunc("POST /api/assignments/{id}/submissions", submitAssignment(db))
	mux.HandleFunc("GET /api/assignments/{id}/submissions", listSubmissions(db))
	mux.HandleFunc("PATCH /api/submissions/{id}", gradeSubmission(db))
	mux.HandleFunc("GET /api/students/{id}/submissions", listStudentSubmissions(db))
}

func createAssignment(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		subjectID := r.PathValue("id")
		var body struct {
			Title          string  `json:"title"`
			Description    string  `json:"description"`
			ClassID        string  `json:"class_id"`
			ScheduledAt    *string `json:"scheduled_at"`
			DueAt          *string `json:"due_at"`
			MaxPoints      int     `json:"max_points"`
			AllowLate      *bool   `json:"allow_late"`
			SubmissionType string  `json:"submission_type"`
			WeekID         string  `json:"week_id"`
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

		maxPoints := body.MaxPoints
		if maxPoints <= 0 {
			maxPoints = 100
		}
		submissionType := body.SubmissionType
		if submissionType != "text" && submissionType != "file" {
			submissionType = "both"
		}
		allowLate := 1
		if body.AllowLate != nil && !*body.AllowLate {
			allowLate = 0
		}

		weekID, problem := weekPlacement(r.Context(), db, subjectID, body.WeekID)
		if problem != "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": problem})
			return
		}

		id, now := util.NewID(), util.Now()
		_, err := db.ExecContext(r.Context(), `
			INSERT INTO assignments (id, subject_id, class_id, title, description, scheduled_at,
			                         due_at, max_points, allow_late, submission_type, is_published,
			                         week_id, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
			id, subjectID, nullIfEmpty(body.ClassID), strings.TrimSpace(body.Title), body.Description,
			nullable(body.ScheduledAt), nullable(body.DueAt), maxPoints, allowLate, submissionType,
			weekID, now, now)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		a, err := scanAssignment(db.QueryRowContext(r.Context(), assignmentSelect+` WHERE a.id = ?`, id))
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusCreated, a)
	}
}

func patchAssignment(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Title          *string `json:"title"`
			Description    *string `json:"description"`
			ClassID        *string `json:"class_id"`
			ScheduledAt    *string `json:"scheduled_at"`
			DueAt          *string `json:"due_at"`
			MaxPoints      *int    `json:"max_points"`
			AllowLate      *bool   `json:"allow_late"`
			SubmissionType *string `json:"submission_type"`
			IsPublished    *bool   `json:"is_published"`
			WeekID         *string `json:"week_id"`
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
		if body.DueAt != nil {
			b.set("due_at", nullIfEmpty(*body.DueAt))
		}
		if body.MaxPoints != nil && *body.MaxPoints > 0 {
			b.set("max_points", *body.MaxPoints)
		}
		if body.AllowLate != nil {
			if *body.AllowLate {
				b.set("allow_late", 1)
			} else {
				b.set("allow_late", 0)
			}
		}
		if body.SubmissionType != nil {
			kind := *body.SubmissionType
			if kind != "text" && kind != "file" {
				kind = "both"
			}
			b.set("submission_type", kind)
		}
		if body.IsPublished != nil {
			if *body.IsPublished {
				b.set("is_published", 1)
			} else {
				b.set("is_published", 0)
			}
		}
		if body.WeekID != nil {
			subjectID, ok := subjectOf(r.Context(), db, "assignments", r.PathValue("id"))
			if !ok {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "assignment not found"})
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

		found, err := b.updateRow(r.Context(), db, "assignments", r.PathValue("id"))
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if !found {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "assignment not found"})
			return
		}
		// A gradebook component built from this assignment carries its title
		// and point ceiling, so editing either here follows through to the
		// grade instead of leaving two different numbers behind.
		if body.Title != nil || body.MaxPoints != nil {
			_, _ = db.ExecContext(r.Context(), `
				UPDATE grade_components
				SET name = COALESCE((SELECT title FROM assignments WHERE id = ?), name),
				    max_points = COALESCE((SELECT max_points FROM assignments WHERE id = ?), max_points)
				WHERE assignment_id = ?`,
				r.PathValue("id"), r.PathValue("id"), r.PathValue("id"))
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// listAssignmentsForStudent returns every published assignment of the subjects
// the student is enrolled in, joined with their own submission (G4).
func listAssignmentsForStudent(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// The caller's own list: the session says whose enrollments count.
		studentID := callerFrom(r).ID

		rows, err := db.QueryContext(r.Context(), `
			SELECT a.id, a.title, COALESCE(a.description, ''), COALESCE(cl.name, ''),
			       COALESCE(a.scheduled_at, ''), COALESCE(a.due_at, ''),
			       a.max_points, a.allow_late, a.submission_type, a.is_published,
			       a.subject_id, s.name,
			       COALESCE(sub.status, ''), sub.score, COALESCE(sub.feedback, ''),
			       COALESCE(sub.submitted_at, '')
			FROM assignments a
			JOIN subjects s ON s.id = a.subject_id
			JOIN enrollments e ON e.subject_id = a.subject_id AND e.student_id = ?
			LEFT JOIN classes cl ON cl.id = a.class_id
			LEFT JOIN assignment_submissions sub
			       ON sub.assignment_id = a.id AND sub.student_id = ?
			WHERE a.is_published = 1
			ORDER BY a.due_at IS NULL, a.due_at, s.name, a.title`, studentID, studentID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		out := []assignmentListOut{}
		for rows.Next() {
			var a assignmentListOut
			if err := rows.Scan(&a.ID, &a.Title, &a.Description, &a.ClassName,
				&a.ScheduledAt, &a.DueAt, &a.MaxPoints, &a.AllowLate, &a.SubmissionType, &a.IsPublished,
				&a.SubjectID, &a.SubjectName,
				&a.StatusCode, &a.Score, &a.Feedback, &a.SubmittedAt); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			a.StatusCode = assignmentStatus(a.StatusCode, a.DueAt, a.AllowLate, a.Score)
			out = append(out, a)
		}
		writeJSON(w, http.StatusOK, out)
	}
}

// assignmentStatus turns the raw submission row into the badge a student sees.
func assignmentStatus(submissionStatus, dueAt string, allowLate bool, score *float64) string {
	switch submissionStatus {
	case "graded":
		return "graded"
	case "submitted", "late":
		return submissionStatus
	}
	if dueAt == "" {
		return "todo"
	}
	due, err := time.Parse(time.RFC3339, dueAt)
	if err != nil {
		if parsed, err := time.Parse("2006-01-02", dueAt); err == nil {
			due = parsed
		} else {
			return "todo"
		}
	}
	if time.Now().UTC().After(due) {
		if allowLate {
			return "overdue"
		}
		return "closed"
	}
	return "todo"
}

func getAssignment(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		id := r.PathValue("id")

		a, err := scanAssignment(db.QueryRowContext(ctx, assignmentSelect+` WHERE a.id = ?`, id))
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "assignment not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		detail := map[string]any{"assignment": a}

		var subjectID, subjectName string
		if err := db.QueryRowContext(ctx, `SELECT a.subject_id, s.name FROM assignments a JOIN subjects s ON s.id = a.subject_id WHERE a.id = ?`, id).
			Scan(&subjectID, &subjectName); err == nil {
			detail["subject_id"] = subjectID
			detail["subject_name"] = subjectName
		}

		// The caller's own submission on this assignment, when they handed one in.
		studentID := callerFrom(r).ID
		{
			sub, err := scanSubmission(db.QueryRowContext(ctx,
				submissionSelect+` WHERE sub.assignment_id = ? AND sub.student_id = ?`, id, studentID))
			if err == nil {
				detail["submission"] = sub
			} else if err != sql.ErrNoRows {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
		}

		writeJSON(w, http.StatusOK, detail)
	}
}

func scanSubmission(row interface{ Scan(...any) error }) (submissionOut, error) {
	var s submissionOut
	var fileName, fileKind sql.NullString
	var fileSize sql.NullInt64
	err := row.Scan(&s.ID, &s.AssignmentID, &s.StudentID, &s.StudentName,
		&s.Content, &s.FileURL, &s.Status, &s.Score, &s.MaxPoints, &s.Feedback,
		&s.SubmittedAt, &s.GradedAt, &fileName, &fileKind, &fileSize)
	if fileName.Valid {
		name := fileName.String
		s.FileName = &name
	}
	if fileKind.Valid {
		kind := fileKind.String
		s.FileKind = &kind
	}
	if fileSize.Valid {
		size := fileSize.Int64
		s.FileSize = &size
	}
	return s, err
}

// submitAssignment upserts the student's work. Resubmitting is allowed while
// the assignment accepts late work and the submission is not yet graded.
func submitAssignment(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		assignmentID := r.PathValue("id")

		var body struct {
			Content string `json:"content"`
			FileURL string `json:"file_url"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		studentID := callerFrom(r).ID

		var dueAt sql.NullString
		var allowLate bool
		var submissionType string
		var published bool
		err := db.QueryRowContext(ctx, `
			SELECT COALESCE(a.due_at, ''), a.allow_late, a.submission_type, a.is_published
			FROM assignments a
			JOIN enrollments e ON e.subject_id = a.subject_id AND e.student_id = ?
			WHERE a.id = ?`, studentID, assignmentID).
			Scan(&dueAt, &allowLate, &submissionType, &published)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "not enrolled in this subject"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if !published {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "assignment is not published"})
			return
		}

		if submissionType == "file" && strings.TrimSpace(body.FileURL) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "this assignment needs a file"})
			return
		}
		if submissionType == "text" && strings.TrimSpace(body.Content) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "this assignment needs a written answer"})
			return
		}

		status := "submitted"
		if dueAt.Valid && dueAt.String != "" {
			if due, err := time.Parse(time.RFC3339, dueAt.String); err == nil && time.Now().UTC().After(due) {
				if !allowLate {
					writeJSON(w, http.StatusForbidden, map[string]string{"error": "the deadline has passed"})
					return
				}
				status = "late"
			}
		}

		var existingID, existingStatus string
		err = db.QueryRowContext(ctx,
			`SELECT id, status FROM assignment_submissions WHERE assignment_id = ? AND student_id = ?`,
			assignmentID, studentID).Scan(&existingID, &existingStatus)
		now := util.Now()

		if err == nil {
			if existingStatus == "graded" {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "this submission has already been graded"})
				return
			}
			_, err = db.ExecContext(ctx, `
				UPDATE assignment_submissions
				SET content = ?, file_url = ?, status = ?, submitted_at = ?, updated_at = ?
				WHERE id = ?`,
				body.Content, nullIfEmpty(body.FileURL), status, now, now, existingID)
		} else if err == sql.ErrNoRows {
			existingID = util.NewID()
			_, err = db.ExecContext(ctx, `
				INSERT INTO assignment_submissions
				  (id, assignment_id, student_id, content, file_url, status, submitted_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				existingID, assignmentID, studentID, body.Content, nullIfEmpty(body.FileURL), status, now, now)
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{"id": existingID, "status": status})
	}
}

// listSubmissions is the lecturer's grading queue for one assignment.
func listSubmissions(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.QueryContext(r.Context(),
			submissionSelect+` WHERE sub.assignment_id = ? ORDER BY u.name`, r.PathValue("id"))
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		out := []submissionOut{}
		for rows.Next() {
			s, err := scanSubmission(rows)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			out = append(out, s)
		}
		writeJSON(w, http.StatusOK, out)
	}
}

// listStudentSubmissions feeds the student's own assignment history (G6).
func listStudentSubmissions(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		studentID := r.PathValue("id")
		if !allowStudentRecord(r, studentID, "assignments.grade") {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "you can only see your own submissions"})
			return
		}
		rows, err := db.QueryContext(r.Context(),
			submissionSelect+` WHERE sub.student_id = ? ORDER BY sub.submitted_at DESC`, studentID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		out := []submissionOut{}
		for rows.Next() {
			s, err := scanSubmission(rows)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			out = append(out, s)
		}
		writeJSON(w, http.StatusOK, out)
	}
}

// gradeSubmission records points + feedback and notifies the student. The
// points also become a graded item of the subject gradebook so the student's
// total reflects the assignment without the lecturer re-keying it.
func gradeSubmission(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		var body struct {
			Score    *float64 `json:"score"`
			Feedback string   `json:"feedback"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}

		var assignmentID, studentID, subjectID string
		var maxPoints int
		err := db.QueryRowContext(ctx, `
			SELECT sub.assignment_id, sub.student_id, a.subject_id, a.max_points
			FROM assignment_submissions sub
			JOIN assignments a ON a.id = sub.assignment_id
			WHERE sub.id = ?`, r.PathValue("id")).
			Scan(&assignmentID, &studentID, &subjectID, &maxPoints)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "submission not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		// Grading is a staff action on the subject, and the grader recorded on
		// the row is the signed-in lecturer (or admin) who did it.
		graderID := callerFrom(r).ID
		if err := requireSubjectStaff(ctx, db, graderID, subjectID); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}
		if body.Score != nil && (*body.Score < 0 || *body.Score > float64(maxPoints)) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "score is outside 0..max_points"})
			return
		}

		now := util.Now()
		status := "graded"
		var score any
		if body.Score != nil {
			score = *body.Score
		} else {
			status = "submitted"
		}

		if _, err := db.ExecContext(ctx, `
			UPDATE assignment_submissions
			SET score = ?, feedback = ?, status = ?, graded_at = ?, graded_by = ?, updated_at = ?
			WHERE id = ?`,
			score, body.Feedback, status, nullableString(status == "graded", now), nullIfEmpty(graderID), now,
			r.PathValue("id")); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		// When the assignment is one of the subject's graded items, the score
		// lands in the gradebook too, so the student's running total is right
		// without the lecturer keying the points twice.
		syncComponentFromSubmission(ctx, db, assignmentID, studentID, body.Score, graderID, now)

		writeJSON(w, http.StatusOK, map[string]string{"status": status})
	}
}
