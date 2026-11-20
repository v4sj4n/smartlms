package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"optimolms/backend/internal/grades"
	"optimolms/backend/internal/util"
)

/* ============================================================================
   GRADEBOOK (B1, B2), STUDY RECORD (B3, B4)
   Lecturers define weighted components and enter points; the subject total is
   computed, mapped to 4-10 and can be overridden by the exam office.
   ========================================================================== */

type gradeComponentOut struct {
	ID            string  `json:"id"`
	SubjectID     string  `json:"subject_id"`
	AssignmentID  *string `json:"assignment_id"`
	Name          string  `json:"name"`
	Type          string  `json:"type"`
	WeightPercent float64 `json:"weight_percent"`
	MaxPoints     int     `json:"max_points"`
	OrderIndex    int     `json:"order_index"`
	IsPublished   bool    `json:"is_published"`
}

type gradebookStudentRow struct {
	ID          string              `json:"id"`
	Name        string              `json:"name"`
	Email       string              `json:"email"`
	Points      map[string]*float64 `json:"points"`
	TotalPoints *float64            `json:"total_points"`
	Grade       *float64            `json:"grade"`
	Coverage    float64             `json:"coverage"`
	IsPassing   bool                `json:"is_passing"`
}

type subjectGradeComponentOut struct {
	gradeComponentOut
	Points  *float64 `json:"points"`
	Comment string   `json:"comment,omitempty"`
}

type subjectGradeOut struct {
	SubjectID      string                     `json:"subject_id"`
	SubjectName    string                     `json:"subject_name"`
	Semester       string                     `json:"semester"`
	SchoolYear     string                     `json:"school_year,omitempty"`
	ECTS           *float64                   `json:"ects"`
	Components     []subjectGradeComponentOut `json:"components"`
	TotalPoints    *float64                   `json:"total_points"`
	Grade          *float64                   `json:"grade"`
	Coverage       float64                    `json:"coverage"`
	PassGrade      float64                    `json:"pass_grade"`
	Status         string                     `json:"status"`
	OfficialPoints *float64                   `json:"official_points"`
	OfficialGrade  *float64                   `json:"official_grade"`
}

type recordEntryOut struct {
	SubjectID   string `json:"subject_id"`
	SubjectName string `json:"subject_name"`
	// SchoolYear is the subject's own school year, reported verbatim (an empty
	// string when the subject has none). It is always on the wire: the study
	// record groups its entries by it, so a missing key would be a different
	// answer from "the year is unknown".
	SchoolYear   string   `json:"school_year"`
	Semester     string   `json:"semester,omitempty"`
	ECTS         *float64 `json:"ects"`
	AttemptNo    int      `json:"attempt_no"`
	TotalPoints  *float64 `json:"total_points"`
	Grade        *float64 `json:"grade"`
	Status       string   `json:"status"`
	IsOfficial   bool     `json:"is_official"`
	IsOverridden bool     `json:"is_overridden"`
	OverrideNote string   `json:"override_note,omitempty"`
}

type recordOut struct {
	Entries         []recordEntryOut `json:"entries"`
	GPA             *float64         `json:"gpa"`
	CreditsEarned   float64          `json:"credits_earned"`
	CreditsInFlight float64          `json:"credits_in_flight"`
	SubjectsPassed  int              `json:"subjects_passed"`
	SubjectsFailed  int              `json:"subjects_failed"`
	PassGrade       float64          `json:"pass_grade"`
	Bands           []grades.Band    `json:"bands"`
}

func registerGrades(mux *http.ServeMux, db *sql.DB) {
	mux.HandleFunc("GET /api/grades/scales", getGradeScales(db))

	// Lecturer gradebook
	mux.HandleFunc("GET /api/subjects/{id}/gradebook", getGradebook(db))
	mux.HandleFunc("POST /api/subjects/{id}/grade-components", createGradeComponent(db))
	mux.HandleFunc("PATCH /api/grade-components/{id}", patchGradeComponent(db))
	mux.HandleFunc("DELETE /api/grade-components/{id}", deleteGradeComponent(db))
	mux.HandleFunc("PUT /api/grade-components/{id}/entries/{studentId}", saveGradeEntry(db))

	// Student views
	mux.HandleFunc("GET /api/students/{id}/grades", getStudentGrades(db))
	mux.HandleFunc("GET /api/students/{id}/grades/{subjectId}", getStudentSubjectGrade(db))
	mux.HandleFunc("GET /api/students/{id}/record", getStudentRecord(db))

	// Exam office override
	mux.HandleFunc("PUT /api/students/{id}/results/{subjectId}", saveSubjectResultOverride(db))
	mux.HandleFunc("DELETE /api/students/{id}/results/{subjectId}", deleteSubjectResultOverride(db))
}

/* ---------- shared helpers ---------- */

func nullable(s *string) any {
	if s == nil || strings.TrimSpace(*s) == "" {
		return nil
	}
	return strings.TrimSpace(*s)
}

func nullableString(ok bool, value string) any {
	if !ok {
		return nil
	}
	return value
}

// requireSubjectStaff allows admins and the subject's own lecturer.
func requireSubjectStaff(ctx context.Context, db *sql.DB, userID, subjectID string) error {
	role, err := roleOf(ctx, db, userID)
	if err != nil {
		return errors.New("unknown user")
	}
	if role == "ADMIN" {
		return nil
	}
	if role != "LECTURER" {
		return errors.New("only the lecturer or an admin can do that")
	}
	var lecturer sql.NullString
	if err := db.QueryRowContext(ctx, `SELECT lecturer_id FROM subjects WHERE id = ?`, subjectID).
		Scan(&lecturer); err != nil {
		return errors.New("subject not found")
	}
	if !lecturer.Valid || lecturer.String != userID {
		return errors.New("only the subject's lecturer can do that")
	}
	return nil
}

// loadScale returns the bands and pass grade for a school year, falling back to
// the default scale row.
func loadScale(ctx context.Context, db *sql.DB, schoolYear string) ([]grades.Band, float64) {
	var bandsJSON string
	var passGrade float64

	if schoolYear != "" {
		err := db.QueryRowContext(ctx, `
			SELECT bands, pass_grade FROM grade_scales
			WHERE school_year = ? ORDER BY is_default DESC LIMIT 1`, schoolYear).
			Scan(&bandsJSON, &passGrade)
		if err == nil {
			if bands := parseBands(bandsJSON); len(bands) > 0 {
				return bands, passGrade
			}
		}
	}

	err := db.QueryRowContext(ctx, `
		SELECT bands, pass_grade FROM grade_scales
		ORDER BY is_default DESC, created_at LIMIT 1`).Scan(&bandsJSON, &passGrade)
	if err != nil {
		return grades.DefaultBands, grades.DefaultPassGrade
	}
	bands := parseBands(bandsJSON)
	if len(bands) == 0 {
		return grades.DefaultBands, grades.DefaultPassGrade
	}
	return bands, passGrade
}

func parseBands(raw string) []grades.Band {
	var bands []grades.Band
	if err := json.Unmarshal([]byte(raw), &bands); err != nil {
		return nil
	}
	return bands
}

type componentRow struct {
	gradeComponentOut
	Points  *float64
	Comment string
}

// subjectComponents loads the published components of a subject, with the
// points of one student when studentID is set.
func subjectComponents(ctx context.Context, db *sql.DB, subjectID, studentID string) ([]componentRow, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT c.id, c.subject_id, c.assignment_id, c.name, c.type, c.weight_percent, c.max_points,
		       c.order_index, c.is_published, e.points, COALESCE(e.comment, '')
		FROM grade_components c
		LEFT JOIN grade_entries e ON e.component_id = c.id AND e.student_id = ?
		WHERE c.subject_id = ? AND c.is_published = 1
		ORDER BY c.order_index, c.name`, studentID, subjectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []componentRow{}
	for rows.Next() {
		var c componentRow
		var assignmentID sql.NullString
		if err := rows.Scan(&c.ID, &c.SubjectID, &assignmentID, &c.Name, &c.Type, &c.WeightPercent,
			&c.MaxPoints, &c.OrderIndex, &c.IsPublished, &c.Points, &c.Comment); err != nil {
			return nil, err
		}
		if assignmentID.Valid {
			value := assignmentID.String
			c.AssignmentID = &value
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func toGradeInputs(rows []componentRow) []grades.Component {
	inputs := make([]grades.Component, 0, len(rows))
	for _, row := range rows {
		inputs = append(inputs, grades.Component{
			ID:        row.ID,
			Name:      row.Name,
			Weight:    row.WeightPercent,
			MaxPoints: float64(row.MaxPoints),
			Points:    row.Points,
		})
	}
	return inputs
}

/* ---------- grade scale ---------- */

func getGradeScales(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.QueryContext(r.Context(), `
			SELECT id, name, COALESCE(school_year, ''), is_default, pass_grade, bands
			FROM grade_scales ORDER BY is_default DESC, name`)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		type scaleOut struct {
			ID         string        `json:"id"`
			Name       string        `json:"name"`
			SchoolYear string        `json:"school_year,omitempty"`
			IsDefault  bool          `json:"is_default"`
			PassGrade  float64       `json:"pass_grade"`
			Bands      []grades.Band `json:"bands"`
		}
		out := []scaleOut{}
		for rows.Next() {
			var s scaleOut
			var bandsJSON string
			if err := rows.Scan(&s.ID, &s.Name, &s.SchoolYear, &s.IsDefault, &s.PassGrade, &bandsJSON); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			s.Bands = parseBands(bandsJSON)
			out = append(out, s)
		}
		writeJSON(w, http.StatusOK, out)
	}
}

/* ---------- lecturer gradebook ---------- */

func getGradebook(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		subjectID := r.PathValue("id")

		if err := requireSubjectStaff(ctx, db, callerFrom(r).ID, subjectID); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}

		var subjectName, semester, schoolYear string
		var ects sql.NullFloat64
		err := db.QueryRowContext(ctx, `
			SELECT name, semester, COALESCE(school_year, ''), ects FROM subjects WHERE id = ?`, subjectID).
			Scan(&subjectName, &semester, &schoolYear, &ects)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "subject not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		allComponents, err := subjectComponents(ctx, db, subjectID, "")
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		rows, err := db.QueryContext(ctx, `
			SELECT u.id, u.name, u.email FROM enrollments e JOIN users u ON u.id = e.student_id
			WHERE e.subject_id = ? ORDER BY u.name`, subjectID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		type studentStub struct{ id, name, email string }
		students := []studentStub{}
		for rows.Next() {
			var s studentStub
			if err := rows.Scan(&s.id, &s.name, &s.email); err != nil {
				rows.Close()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			students = append(students, s)
		}
		rows.Close()

		bands, passGrade := loadScale(ctx, db, schoolYear)

		out := []gradebookStudentRow{}
		for _, student := range students {
			components, err := subjectComponents(ctx, db, subjectID, student.id)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			total := grades.WeightedTotal(toGradeInputs(components), bands)
			points := map[string]*float64{}
			for _, component := range components {
				points[component.ID] = component.Points
			}
			out = append(out, gradebookStudentRow{
				ID:          student.id,
				Name:        student.name,
				Email:       student.email,
				Points:      points,
				TotalPoints: total.Points,
				Grade:       total.Grade,
				Coverage:    total.Coverage,
				IsPassing:   total.Grade != nil && grades.IsPass(*total.Grade, passGrade),
			})
		}

		components := make([]gradeComponentOut, 0, len(allComponents))
		for _, component := range allComponents {
			components = append(components, component.gradeComponentOut)
		}

		var ectsOut *float64
		if ects.Valid {
			value := ects.Float64
			ectsOut = &value
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"subject_id":   subjectID,
			"subject_name": subjectName,
			"semester":     semester,
			"school_year":  schoolYear,
			"ects":         ectsOut,
			"pass_grade":   passGrade,
			"components":   components,
			"students":     out,
		})
	}
}

func createGradeComponent(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		subjectID := r.PathValue("id")

		var body struct {
			Name          string  `json:"name"`
			Type          string  `json:"type"`
			WeightPercent float64 `json:"weight_percent"`
			MaxPoints     int     `json:"max_points"`
			AssignmentID  string  `json:"assignment_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		userID := callerFrom(r).ID
		if err := requireSubjectStaff(ctx, db, userID, subjectID); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}
		if body.WeightPercent < 0 || body.WeightPercent > 100 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "weight_percent must be between 0 and 100"})
			return
		}

		name := strings.TrimSpace(body.Name)
		kind := body.Type
		maxPoints := body.MaxPoints
		assignmentID := strings.TrimSpace(body.AssignmentID)
		var assignmentIDValue any

		// A component built from an assignment takes the assignment's own name
		// and point ceiling, so the two can never drift apart.
		if assignmentID != "" {
			var title, assignmentSubject string
			var assignmentPoints int
			err := db.QueryRowContext(ctx, `SELECT title, subject_id, max_points FROM assignments WHERE id = ?`, assignmentID).
				Scan(&title, &assignmentSubject, &assignmentPoints)
			if err == sql.ErrNoRows {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "assignment not found"})
				return
			}
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			if assignmentSubject != subjectID {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "that assignment belongs to another subject"})
				return
			}
			var linked int
			if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM grade_components WHERE assignment_id = ?`, assignmentID).
				Scan(&linked); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			if linked > 0 {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "that assignment already counts towards the grade"})
				return
			}
			name = title
			kind = "assignment"
			if assignmentPoints > 0 {
				maxPoints = assignmentPoints
			}
			assignmentIDValue = assignmentID
		}

		if name == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name is required"})
			return
		}
		switch kind {
		case "assignment", "midterm", "final", "engagement", "coursework", "project", "other":
		default:
			kind = "coursework"
		}
		if maxPoints <= 0 {
			maxPoints = 100
		}

		var order int
		_ = db.QueryRowContext(ctx, `SELECT COALESCE(MAX(order_index), -1) + 1 FROM grade_components WHERE subject_id = ?`, subjectID).
			Scan(&order)

		id, now := util.NewID(), util.Now()
		if _, err := db.ExecContext(ctx, `
			INSERT INTO grade_components (id, subject_id, assignment_id, name, type, weight_percent, max_points,
			                              order_index, is_published, created_by, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
			id, subjectID, assignmentIDValue, name, kind, body.WeightPercent, maxPoints,
			order, userID, now, now); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		// Whatever the lecturer already graded on that assignment becomes the
		// starting points of the new component.
		var linkedAssignment *string
		if assignmentIDValue != nil {
			linkedAssignment = &assignmentID
			backfillComponentFromAssignment(ctx, db, subjectID, assignmentID, id, userID, now)
		}

		writeJSON(w, http.StatusCreated, gradeComponentOut{
			ID: id, SubjectID: subjectID, AssignmentID: linkedAssignment, Name: name, Type: kind,
			WeightPercent: body.WeightPercent, MaxPoints: maxPoints, OrderIndex: order, IsPublished: true,
		})
	}
}

// backfillComponentFromAssignment copies the points a lecturer already gave on
// the assignment's submissions into the gradebook component. It never creates
// submissions: students who have not submitted stay ungraded.
func backfillComponentFromAssignment(ctx context.Context, db *sql.DB, subjectID, assignmentID, componentID, graderID, now string) {
	rows, err := db.QueryContext(ctx, `
		SELECT sub.student_id, sub.score
		FROM assignment_submissions sub
		JOIN enrollments e ON e.student_id = sub.student_id AND e.subject_id = ?
		WHERE sub.assignment_id = ? AND sub.score IS NOT NULL`, subjectID, assignmentID)
	if err != nil {
		return
	}
	defer rows.Close()

	type entry struct {
		studentID string
		score     float64
	}
	entries := []entry{}
	for rows.Next() {
		var item entry
		if err := rows.Scan(&item.studentID, &item.score); err != nil {
			return
		}
		entries = append(entries, item)
	}
	if err := rows.Err(); err != nil {
		return
	}

	for _, item := range entries {
		_, _ = db.ExecContext(ctx, `
			INSERT INTO grade_entries (id, component_id, student_id, points, graded_by, graded_at, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT (component_id, student_id) DO UPDATE SET
			  points = excluded.points,
			  graded_by = excluded.graded_by,
			  graded_at = excluded.graded_at,
			  updated_at = excluded.updated_at`,
			util.NewID(), componentID, item.studentID, item.score, nullIfEmpty(graderID), now, now, now)
	}
}

// syncComponentFromSubmission keeps a gradebook component linked to an
// assignment in step with the submission score. A component that is not linked
// is left alone, so manual components stay manual.
func syncComponentFromSubmission(ctx context.Context, db *sql.DB, assignmentID, studentID string, score *float64, graderID, now string) {
	var componentID string
	if err := db.QueryRowContext(ctx,
		`SELECT id FROM grade_components WHERE assignment_id = ?`, assignmentID).Scan(&componentID); err != nil {
		return
	}
	var points any
	if score != nil {
		points = *score
	}
	_, _ = db.ExecContext(ctx, `
		INSERT INTO grade_entries (id, component_id, student_id, points, graded_by, graded_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT (component_id, student_id) DO UPDATE SET
		  points = excluded.points,
		  graded_by = excluded.graded_by,
		  graded_at = excluded.graded_at,
		  updated_at = excluded.updated_at`,
		util.NewID(), componentID, studentID, points, nullIfEmpty(graderID),
		nullableString(score != nil, now), now, now)
}

func patchGradeComponent(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		componentID := r.PathValue("id")

		var subjectID string
		if err := db.QueryRowContext(ctx, `SELECT subject_id FROM grade_components WHERE id = ?`, componentID).
			Scan(&subjectID); err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "component not found"})
			return
		}

		var body struct {
			Name          *string  `json:"name"`
			Type          *string  `json:"type"`
			WeightPercent *float64 `json:"weight_percent"`
			MaxPoints     *int     `json:"max_points"`
			IsPublished   *bool    `json:"is_published"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		if err := requireSubjectStaff(ctx, db, callerFrom(r).ID, subjectID); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
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
		if body.Type != nil {
			b.set("type", *body.Type)
		}
		if body.WeightPercent != nil {
			if *body.WeightPercent < 0 || *body.WeightPercent > 100 {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "weight_percent must be between 0 and 100"})
				return
			}
			b.set("weight_percent", *body.WeightPercent)
		}
		if body.MaxPoints != nil && *body.MaxPoints > 0 {
			b.set("max_points", *body.MaxPoints)
		}
		if body.IsPublished != nil {
			if *body.IsPublished {
				b.set("is_published", 1)
			} else {
				b.set("is_published", 0)
			}
		}
		if b.empty() {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "nothing to update"})
			return
		}
		if _, err := b.updateRow(ctx, db, "grade_components", componentID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func deleteGradeComponent(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		componentID := r.PathValue("id")

		var subjectID string
		if err := db.QueryRowContext(ctx, `SELECT subject_id FROM grade_components WHERE id = ?`, componentID).
			Scan(&subjectID); err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "component not found"})
			return
		}

		if err := requireSubjectStaff(ctx, db, callerFrom(r).ID, subjectID); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}

		if _, err := db.ExecContext(ctx, `DELETE FROM grade_components WHERE id = ?`, componentID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// saveGradeEntry upserts one student's points for one component.
func saveGradeEntry(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		componentID := r.PathValue("id")
		studentID := r.PathValue("studentId")

		var subjectID string
		var maxPoints int
		var assignmentID sql.NullString
		if err := db.QueryRowContext(ctx,
			`SELECT subject_id, max_points, assignment_id FROM grade_components WHERE id = ?`, componentID).
			Scan(&subjectID, &maxPoints, &assignmentID); err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "component not found"})
			return
		}

		var body struct {
			Points  *float64 `json:"points"`
			Comment string   `json:"comment"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		userID := callerFrom(r).ID
		if err := requireSubjectStaff(ctx, db, userID, subjectID); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}
		if body.Points != nil && (*body.Points < 0 || *body.Points > float64(maxPoints)) {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": fmt.Sprintf("points must be between 0 and %d", maxPoints),
			})
			return
		}
		var enrolled int
		if err := db.QueryRowContext(ctx,
			`SELECT COUNT(*) FROM enrollments WHERE subject_id = ? AND student_id = ?`, subjectID, studentID).
			Scan(&enrolled); err != nil || enrolled == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "student is not enrolled in this subject"})
			return
		}

		now := util.Now()
		var points any
		if body.Points != nil {
			points = *body.Points
		}
		var comment any
		if strings.TrimSpace(body.Comment) != "" {
			comment = strings.TrimSpace(body.Comment)
		}

		if _, err := db.ExecContext(ctx, `
			INSERT INTO grade_entries (id, component_id, student_id, points, comment, graded_by, graded_at, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT (component_id, student_id) DO UPDATE SET
			  points = excluded.points,
			  comment = excluded.comment,
			  graded_by = excluded.graded_by,
			  graded_at = excluded.graded_at,
			  updated_at = excluded.updated_at`,
			util.NewID(), componentID, studentID, points, comment, nullIfEmpty(userID),
			nullableString(body.Points != nil, now), now, now); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		// A component that came from an assignment writes the points back onto
		// the student's submission, so the assignment list and the gradebook
		// never show two different numbers.
		if assignmentID.Valid {
			status := "submitted"
			if body.Points != nil {
				status = "graded"
			}
			_, _ = db.ExecContext(ctx, `
				UPDATE assignment_submissions
				SET score = ?, status = ?, graded_at = ?, graded_by = ?, updated_at = ?
				WHERE assignment_id = ? AND student_id = ?`,
				points, status, nullableString(body.Points != nil, now), nullIfEmpty(userID), now,
				assignmentID.String, studentID)
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

/* ---------- student views ---------- */

func getStudentGrades(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		studentID := r.PathValue("id")
		// A student's own card, or a staff member who may manage the gradebook.
		if !allowStudentRecord(r, studentID, "grades.manage") {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "you can only see your own grades"})
			return
		}
		out, err := buildStudentGrades(ctx, db, studentID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, out)
	}
}

func getStudentSubjectGrade(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		studentID := r.PathValue("id")
		subjectID := r.PathValue("subjectId")
		if !allowStudentRecord(r, studentID, "grades.manage") {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "you can only see your own grades"})
			return
		}

		grade, err := buildSubjectGrade(ctx, db, studentID, subjectID)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "subject not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, grade)
	}
}

func buildStudentGrades(ctx context.Context, db *sql.DB, studentID string) ([]subjectGradeOut, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT s.id FROM subjects s JOIN enrollments e ON e.subject_id = s.id
		WHERE e.student_id = ? ORDER BY s.school_year, s.semester, s.name`, studentID)
	if err != nil {
		return nil, err
	}
	subjectIDs := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return nil, err
		}
		subjectIDs = append(subjectIDs, id)
	}
	rows.Close()

	out := []subjectGradeOut{}
	for _, subjectID := range subjectIDs {
		grade, err := buildSubjectGrade(ctx, db, studentID, subjectID)
		if err != nil {
			return nil, err
		}
		out = append(out, grade)
	}
	return out, nil
}

func buildSubjectGrade(ctx context.Context, db *sql.DB, studentID, subjectID string) (subjectGradeOut, error) {
	var (
		name, semester, schoolYear string
		ects                       sql.NullFloat64
	)
	err := db.QueryRowContext(ctx,
		`SELECT name, semester, COALESCE(school_year, ''), ects FROM subjects WHERE id = ?`, subjectID).
		Scan(&name, &semester, &schoolYear, &ects)
	if err != nil {
		return subjectGradeOut{}, err
	}

	components, err := subjectComponents(ctx, db, subjectID, studentID)
	if err != nil {
		return subjectGradeOut{}, err
	}
	bands, passGrade := loadScale(ctx, db, schoolYear)
	total := grades.WeightedTotal(toGradeInputs(components), bands)

	componentOut := make([]subjectGradeComponentOut, 0, len(components))
	for _, component := range components {
		componentOut = append(componentOut, subjectGradeComponentOut{
			gradeComponentOut: component.gradeComponentOut,
			Points:            component.Points,
			Comment:           component.Comment,
		})
	}

	var officialPoints, officialGrade *float64
	var overridePoints, overrideGrade sql.NullFloat64
	var ignored sql.NullString
	_ = db.QueryRowContext(ctx, `
		SELECT override_points, override_grade, COALESCE(override_note, '')
		FROM subject_results WHERE student_id = ? AND subject_id = ?
		ORDER BY attempt_no DESC LIMIT 1`, studentID, subjectID).
		Scan(&overridePoints, &overrideGrade, &ignored)
	if overridePoints.Valid {
		value := overridePoints.Float64
		officialPoints = &value
	}
	if overrideGrade.Valid {
		value := overrideGrade.Float64
		officialGrade = &value
	}

	var ectsOut *float64
	if ects.Valid {
		value := ects.Float64
		ectsOut = &value
	}

	return subjectGradeOut{
		SubjectID:      subjectID,
		SubjectName:    name,
		Semester:       semester,
		SchoolYear:     schoolYear,
		ECTS:           ectsOut,
		Components:     componentOut,
		TotalPoints:    total.Points,
		Grade:          total.Grade,
		Coverage:       total.Coverage,
		PassGrade:      passGrade,
		Status:         grades.StatusFor(total.Grade, total.Coverage, passGrade),
		OfficialPoints: officialPoints,
		OfficialGrade:  officialGrade,
	}, nil
}

// getStudentRecord is the study card: gradebook-derived rows merged with the
// exam office overrides, plus the ECTS-weighted GPA.
func getStudentRecord(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		studentID := r.PathValue("id")
		if !allowStudentRecord(r, studentID, "records.manage") {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "you can only see your own record"})
			return
		}

		record, err := buildStudentRecord(ctx, db, studentID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, record)
	}
}

// buildStudentRecord merges the gradebook-derived rows with the exam office
// overrides and summarises them into credits and the ECTS-weighted GPA. The
// study card and the student list both use it, so they never disagree.
func buildStudentRecord(ctx context.Context, db *sql.DB, studentID string) (recordOut, error) {
	gradesList, err := buildStudentGrades(ctx, db, studentID)
	if err != nil {
		return recordOut{}, err
	}

	type overrideRow struct {
		attemptNo  int
		points     sql.NullFloat64
		grade      sql.NullFloat64
		note       string
		status     string
		isOfficial bool
		ects       sql.NullFloat64
	}
	overrides := map[string]overrideRow{}
	rows, err := db.QueryContext(ctx, `
		SELECT subject_id, attempt_no, override_points, override_grade, COALESCE(override_note, ''),
		       status, is_official, ects
		FROM subject_results WHERE student_id = ? ORDER BY attempt_no`, studentID)
	if err != nil {
		return recordOut{}, err
	}
	for rows.Next() {
		var subjectID string
		var row overrideRow
		if err := rows.Scan(&subjectID, &row.attemptNo, &row.points, &row.grade, &row.note,
			&row.status, &row.isOfficial, &row.ects); err != nil {
			rows.Close()
			return recordOut{}, err
		}
		overrides[subjectID] = row
	}
	rows.Close()

	entries := []recordEntryOut{}
	results := []grades.Result{}
	passGrade := float64(grades.DefaultPassGrade)
	var bands []grades.Band

	for _, subject := range gradesList {
		entry := recordEntryOut{
			SubjectID:   subject.SubjectID,
			SubjectName: subject.SubjectName,
			SchoolYear:  subject.SchoolYear,
			Semester:    subject.Semester,
			ECTS:        subject.ECTS,
			AttemptNo:   1,
			TotalPoints: subject.TotalPoints,
			Grade:       subject.Grade,
			Status:      subject.Status,
		}
		passGrade = subject.PassGrade
		bands, _ = loadScale(ctx, db, subject.SchoolYear)

		if override, ok := overrides[subject.SubjectID]; ok {
			entry.AttemptNo = override.attemptNo
			entry.IsOfficial = override.isOfficial
			entry.IsOverridden = true
			entry.OverrideNote = override.note
			if override.points.Valid {
				value := override.points.Float64
				entry.TotalPoints = &value
			}
			if override.grade.Valid {
				value := override.grade.Float64
				entry.Grade = &value
			}
			if override.ects.Valid {
				value := override.ects.Float64
				entry.ECTS = &value
			}
			entry.Status = override.status
		}

		entries = append(entries, entry)
		results = append(results, grades.Result{
			Grade: entry.Grade, ECTS: entry.ECTS, Status: entry.Status,
		})
	}

	summary := grades.Summarise(results)
	if len(bands) == 0 {
		bands = grades.DefaultBands
	}

	return recordOut{
		Entries:         entries,
		GPA:             summary.GPA,
		CreditsEarned:   summary.CreditsEarned,
		CreditsInFlight: summary.CreditsInFlight,
		SubjectsPassed:  summary.SubjectsPassed,
		SubjectsFailed:  summary.SubjectsFailed,
		PassGrade:       passGrade,
		Bands:           bands,
	}, nil
}

/* ---------- exam office override ---------- */

func saveSubjectResultOverride(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		studentID := r.PathValue("id")
		subjectID := r.PathValue("subjectId")

		var body struct {
			AttemptNo      int      `json:"attempt_no"`
			OverridePoints *float64 `json:"override_points"`
			OverrideGrade  *float64 `json:"override_grade"`
			Note           string   `json:"note"`
			Status         string   `json:"status"`
			IsOfficial     *bool    `json:"is_official"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		userID := callerFrom(r).ID
		if !callerFrom(r).isAdmin() {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "only the exam office can set official results"})
			return
		}

		var semester, schoolYear string
		var ects sql.NullFloat64
		err := db.QueryRowContext(ctx,
			`SELECT semester, COALESCE(school_year, ''), ects FROM subjects WHERE id = ?`, subjectID).
			Scan(&semester, &schoolYear, &ects)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "subject not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		bands, passGrade := loadScale(ctx, db, schoolYear)
		gradeValue := body.OverrideGrade
		if gradeValue == nil && body.OverridePoints != nil {
			value := grades.PointsToGrade(*body.OverridePoints, bands)
			gradeValue = &value
		}
		status := body.Status
		if status != "passed" && status != "failed" && status != "in_progress" && status != "withdrawn" {
			if gradeValue == nil {
				status = "in_progress"
			} else if grades.IsPass(*gradeValue, passGrade) {
				status = "passed"
			} else {
				status = "failed"
			}
		}

		attempt := body.AttemptNo
		if attempt <= 0 {
			attempt = 1
		}
		isOfficial := 1
		if body.IsOfficial != nil && !*body.IsOfficial {
			isOfficial = 0
		}

		var ectsValue any
		if ects.Valid {
			ectsValue = ects.Float64
		}

		now := util.Now()
		_, err = db.ExecContext(ctx, `
			INSERT INTO subject_results
			  (id, student_id, subject_id, school_year, semester, attempt_no, grade_value, status, ects,
			   source, is_official, override_points, override_grade, override_note, override_by, override_at,
			   computed_at, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT (student_id, subject_id, attempt_no) DO UPDATE SET
			  override_points = excluded.override_points,
			  override_grade = excluded.override_grade,
			  override_note = excluded.override_note,
			  override_by = excluded.override_by,
			  override_at = excluded.override_at,
			  grade_value = excluded.grade_value,
			  status = excluded.status,
			  ects = excluded.ects,
			  is_official = excluded.is_official,
			  updated_at = excluded.updated_at`,
			util.NewID(), studentID, subjectID, nullIfEmpty(schoolYear), semester, attempt,
			valueOrNil(gradeValue), status, ectsValue, isOfficial,
			valueOrNil(body.OverridePoints), valueOrNil(gradeValue), body.Note, userID, now, now, now, now)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"status": status, "grade": gradeValue, "attempt_no": attempt,
		})
	}
}

func deleteSubjectResultOverride(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		if !callerFrom(r).isAdmin() {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "only the exam office can clear official results"})
			return
		}
		if _, err := db.ExecContext(ctx,
			`DELETE FROM subject_results WHERE student_id = ? AND subject_id = ?`,
			r.PathValue("id"), r.PathValue("subjectId")); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func valueOrNil(value *float64) any {
	if value == nil {
		return nil
	}
	return *value
}
