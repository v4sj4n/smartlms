package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"smartlms/backend/internal/util"
)

type lectureOut struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	ClassID     string `json:"class_id,omitempty"`
	ClassName   string `json:"class_name,omitempty"`
	ScheduledAt string `json:"scheduled_at,omitempty"`
}

type seminarOut = lectureOut

type quizOut struct {
	ID               string `json:"id"`
	Title            string `json:"title"`
	Description      string `json:"description,omitempty"`
	TimeLimitMinutes int    `json:"time_limit_minutes,omitempty"`
	QuestionCount    int    `json:"question_count"`
}

type flashcardOut struct {
	ID    string `json:"id"`
	Front string `json:"front"`
	Back  string `json:"back"`
}

type subjectOut struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Code         string `json:"code,omitempty"`
	Description  string `json:"description,omitempty"`
	LecturerID   string `json:"lecturer_id,omitempty"`
	LecturerName string `json:"lecturer_name,omitempty"`
	Counts       struct {
		Lectures   int `json:"lectures"`
		Seminars   int `json:"seminars"`
		Quizzes    int `json:"quizzes"`
		Flashcards int `json:"flashcards"`
	} `json:"counts"`
}

type subjectDetailOut struct {
	subjectOut
	Lectures   []lectureOut   `json:"lectures"`
	Seminars   []seminarOut   `json:"seminars"`
	Quizzes    []quizOut      `json:"quizzes"`
	Flashcards []flashcardOut `json:"flashcards"`
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

	mux.HandleFunc("POST /api/subjects/{id}/seminars", createSeminar(db))
	mux.HandleFunc("PATCH /api/seminars/{id}", patchLecture(db, "seminars"))
	mux.HandleFunc("DELETE /api/seminars/{id}", deleteByID(db, "seminars"))

	mux.HandleFunc("POST /api/subjects/{id}/quizzes", createQuiz(db))
	mux.HandleFunc("PATCH /api/quizzes/{id}", patchQuiz(db))
	mux.HandleFunc("DELETE /api/quizzes/{id}", deleteByID(db, "quizzes"))

	mux.HandleFunc("POST /api/subjects/{id}/flashcards", createFlashcard(db))
	mux.HandleFunc("PATCH /api/flashcards/{id}", patchFlashcard(db))
	mux.HandleFunc("DELETE /api/flashcards/{id}", deleteByID(db, "flashcards"))
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
	       (SELECT COUNT(*) FROM lectures   x WHERE x.subject_id = c.id),
	       (SELECT COUNT(*) FROM seminars   x WHERE x.subject_id = c.id),
	       (SELECT COUNT(*) FROM quizzes    x WHERE x.subject_id = c.id),
	       (SELECT COUNT(*) FROM flashcards x WHERE x.subject_id = c.id)
	FROM subjects c
	LEFT JOIN users u ON u.id = c.lecturer_id`

func scanSubject(row interface{ Scan(...any) error }) (subjectOut, error) {
	var c subjectOut
	err := row.Scan(&c.ID, &c.Name, &c.Code, &c.Description,
		&c.LecturerID, &c.LecturerName,
		&c.Counts.Lectures, &c.Counts.Seminars, &c.Counts.Quizzes, &c.Counts.Flashcards)
	return c, err
}

func listSubjects(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		page, size := pagination(r)

		var total int
		if err := db.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM subjects`).Scan(&total); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		rows, err := db.QueryContext(r.Context(), subjectSelect+` ORDER BY c.name LIMIT ? OFFSET ?`, size, offset(page, size))
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

		detail := subjectDetailOut{
			subjectOut:  c,
			Lectures:   []lectureOut{},
			Seminars:   []seminarOut{},
			Quizzes:    []quizOut{},
			Flashcards: []flashcardOut{},
		}

		for _, table := range []string{"lectures", "seminars"} {
			rows, err := db.QueryContext(ctx, fmt.Sprintf(`
				SELECT x.id, x.title, COALESCE(x.description, ''), COALESCE(x.class_id, ''),
				       COALESCE(cl.name, ''), COALESCE(x.scheduled_at, '')
				FROM %s x LEFT JOIN classes cl ON cl.id = x.class_id
				WHERE x.subject_id = ? ORDER BY x.scheduled_at, x.title`, table), id)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			for rows.Next() {
				var l lectureOut
				if err := rows.Scan(&l.ID, &l.Title, &l.Description, &l.ClassID, &l.ClassName, &l.ScheduledAt); err != nil {
					rows.Close()
					writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
					return
				}
				if table == "lectures" {
					detail.Lectures = append(detail.Lectures, l)
				} else {
					detail.Seminars = append(detail.Seminars, l)
				}
			}
			rows.Close()
		}

		quizRows, err := db.QueryContext(ctx, `
			SELECT q.id, q.title, COALESCE(q.description, ''), COALESCE(q.time_limit_minutes, 0),
			       (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id)
			FROM quizzes q WHERE q.subject_id = ? ORDER BY q.title`, id)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		for quizRows.Next() {
			var q quizOut
			if err := quizRows.Scan(&q.ID, &q.Title, &q.Description, &q.TimeLimitMinutes, &q.QuestionCount); err != nil {
				quizRows.Close()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			detail.Quizzes = append(detail.Quizzes, q)
		}
		quizRows.Close()

		cardRows, err := db.QueryContext(ctx, `SELECT id, front, back FROM flashcards WHERE subject_id = ? ORDER BY created_at`, id)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		for cardRows.Next() {
			var f flashcardOut
			if err := cardRows.Scan(&f.ID, &f.Front, &f.Back); err != nil {
				cardRows.Close()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			detail.Flashcards = append(detail.Flashcards, f)
		}
		cardRows.Close()

		writeJSON(w, http.StatusOK, detail)
	}
}

func createSubject(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Name        string `json:"name"`
			Code        string `json:"code"`
			Description string `json:"description"`
			LecturerID  string `json:"lecturer_id"`
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
		_, err := db.ExecContext(r.Context(),
			`INSERT INTO subjects (id, name, code, description, lecturer_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			id, strings.TrimSpace(body.Name), code, body.Description, lecturerID, now, now)
		if err != nil {
			if strings.Contains(err.Error(), "UNIQUE") {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "a subject with that code already exists"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusCreated, map[string]string{"id": id})
	}
}

func patchSubject(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Name        *string `json:"name"`
			Code        *string `json:"code"`
			Description *string `json:"description"`
			LecturerID  *string `json:"lecturer_id"`
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
		_, err := db.ExecContext(r.Context(), fmt.Sprintf(`
			INSERT INTO %s (id, subject_id, class_id, title, description, scheduled_at, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, table),
			id, subjectID, nullIfEmpty(body.ClassID), strings.TrimSpace(body.Title), body.Description, scheduled, now, now)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusCreated, lectureOut{ID: id, Title: strings.TrimSpace(body.Title), Description: body.Description, ClassID: body.ClassID})
	}
}

func createLecture(db *sql.DB) http.HandlerFunc { return createSession(db, "lectures") }
func createSeminar(db *sql.DB) http.HandlerFunc { return createSession(db, "seminars") }

func patchLecture(db *sql.DB, table string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Title       *string `json:"title"`
			Description *string `json:"description"`
			ClassID     *string `json:"class_id"`
			ScheduledAt *string `json:"scheduled_at"`
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
		if _, err := db.ExecContext(r.Context(),
			`INSERT INTO quizzes (id, subject_id, title, description, time_limit_minutes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			id, subjectID, strings.TrimSpace(body.Title), body.Description, body.TimeLimitMinutes, now, now); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusCreated, quizOut{ID: id, Title: strings.TrimSpace(body.Title), Description: body.Description, TimeLimitMinutes: body.TimeLimitMinutes})
	}
}

func patchQuiz(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Title            *string `json:"title"`
			Description      *string `json:"description"`
			TimeLimitMinutes *int    `json:"time_limit_minutes"`
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

/* ---------- flashcards ---------- */

func createFlashcard(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		subjectID := r.PathValue("id")
		var body struct {
			Front string `json:"front"`
			Back  string `json:"back"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		if strings.TrimSpace(body.Front) == "" || strings.TrimSpace(body.Back) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "front and back are required"})
			return
		}
		if !rowExists(r.Context(), db, "subjects", subjectID) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "subject not found"})
			return
		}
		id, now := util.NewID(), util.Now()
		if _, err := db.ExecContext(r.Context(),
			`INSERT INTO flashcards (id, subject_id, front, back, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
			id, subjectID, strings.TrimSpace(body.Front), strings.TrimSpace(body.Back), now, now); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusCreated, flashcardOut{ID: id, Front: strings.TrimSpace(body.Front), Back: strings.TrimSpace(body.Back)})
	}
}

func patchFlashcard(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Front *string `json:"front"`
			Back  *string `json:"back"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		var b setBuilder
		if body.Front != nil {
			if strings.TrimSpace(*body.Front) == "" {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "front cannot be empty"})
				return
			}
			b.set("front", strings.TrimSpace(*body.Front))
		}
		if body.Back != nil {
			if strings.TrimSpace(*body.Back) == "" {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "back cannot be empty"})
				return
			}
			b.set("back", strings.TrimSpace(*body.Back))
		}
		if b.empty() {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "nothing to update"})
			return
		}
		found, err := b.updateRow(r.Context(), db, "flashcards", r.PathValue("id"))
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if !found {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "flashcard not found"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
