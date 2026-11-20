package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"smartlms/backend/internal/util"
)

/* ============================================================================
   QUIZ ATTEMPTS (A4) WITH TIME LIMITS (G7)
   Starting an attempt stamps `started_at` and, when the quiz (or a timed seminar
   built on one) has a time limit, an `expires_at`. Submitting after the deadline
   still stores the answers but marks the attempt expired, so a student cannot
   begin the clock, walk away and hand in later.
   ========================================================================== */

type attemptOut struct {
	ID          string `json:"id"`
	QuizID      string `json:"quiz_id"`
	QuizTitle   string `json:"quiz_title,omitempty"`
	SubjectID   string `json:"subject_id,omitempty"`
	SubjectName string `json:"subject_name,omitempty"`
	Score       int    `json:"score"`
	MaxScore    int    `json:"max_score"`
	Status      string `json:"status"`
	StartedAt   string `json:"started_at"`
	ExpiresAt   string `json:"expires_at,omitempty"`
	CompletedAt string `json:"completed_at,omitempty"`
	SecondsLeft int    `json:"seconds_left"`
}

func registerQuizAttempts(mux *http.ServeMux, db *sql.DB) {
	mux.HandleFunc("GET /api/quizzes/{id}/attempts", listQuizAttempts(db))
	mux.HandleFunc("GET /api/quizzes/{id}/questions", listQuizQuestions(db))
	mux.HandleFunc("POST /api/quizzes/{id}/attempts", startQuizAttempt(db))
	mux.HandleFunc("POST /api/attempts/{id}/submit", submitQuizAttempt(db))
	mux.HandleFunc("GET /api/students/{id}/quiz-attempts", listStudentQuizAttempts(db))
}

// startQuizAttempt opens (or resumes) the student's attempt on a quiz.
func startQuizAttempt(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		quizID := r.PathValue("id")

		var body struct {
			StudentID string `json:"student_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		if body.StudentID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "student_id is required"})
			return
		}

		var timeLimit sql.NullInt64
		err := db.QueryRowContext(ctx, `
			SELECT COALESCE(q.time_limit_minutes, 0)
			FROM quizzes q
			JOIN enrollments e ON e.subject_id = q.subject_id AND e.student_id = ?
			WHERE q.id = ?`, body.StudentID, quizID).Scan(&timeLimit)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "not enrolled in this subject"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		var maxScore int
		_ = db.QueryRowContext(ctx, `SELECT COALESCE(SUM(points), 0) FROM quiz_questions WHERE quiz_id = ?`, quizID).
			Scan(&maxScore)

		// Resume an attempt that is still running.
		var (
			existingID, startedAt, status string
			expiresAt, completedAt        sql.NullString
		)
		err = db.QueryRowContext(ctx, `
			SELECT id, started_at, expires_at, status, completed_at
			FROM quiz_attempts
			WHERE quiz_id = ? AND student_id = ? AND status = 'in_progress'
			ORDER BY started_at DESC LIMIT 1`, quizID, body.StudentID).
			Scan(&existingID, &startedAt, &expiresAt, &status, &completedAt)
		if err == nil {
			writeJSON(w, http.StatusOK, attemptOut{
				ID: existingID, QuizID: quizID, Status: status,
				StartedAt: startedAt, ExpiresAt: expiresAt.String, MaxScore: maxScore,
				SecondsLeft: secondsLeft(expiresAt.String),
			})
			return
		}
		if err != sql.ErrNoRows {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		id, now := util.NewID(), util.Now()
		var expires any
		if timeLimit.Valid && timeLimit.Int64 > 0 {
			deadline := time.Now().UTC().Add(time.Duration(timeLimit.Int64) * time.Minute).Format(time.RFC3339)
			expires = deadline
		}

		if _, err := db.ExecContext(ctx, `
			INSERT INTO quiz_attempts (id, quiz_id, student_id, score, started_at, expires_at, status)
			VALUES (?, ?, ?, 0, ?, ?, 'in_progress')`, id, quizID, body.StudentID, now, expires); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		expiresString := ""
		if expires != nil {
			expiresString = expires.(string)
		}
		writeJSON(w, http.StatusCreated, attemptOut{
			ID: id, QuizID: quizID, Status: "in_progress", StartedAt: now,
			ExpiresAt: expiresString, MaxScore: maxScore, SecondsLeft: secondsLeft(expiresString),
		})
	}
}

func secondsLeft(expiresAt string) int {
	if expiresAt == "" {
		return -1
	}
	deadline, err := time.Parse(time.RFC3339, expiresAt)
	if err != nil {
		return -1
	}
	left := int(time.Until(deadline).Seconds())
	if left < 0 {
		return 0
	}
	return left
}

// submitQuizAttempt scores the answers and closes the attempt.
func submitQuizAttempt(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		attemptID := r.PathValue("id")

		var body struct {
			Answers map[string]string `json:"answers"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}

		var (
			quizID, studentID, status string
			expiresAt                 sql.NullString
			score                     int
		)
		err := db.QueryRowContext(ctx,
			`SELECT quiz_id, student_id, status, expires_at, score FROM quiz_attempts WHERE id = ?`, attemptID).
			Scan(&quizID, &studentID, &status, &expiresAt, &score)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "attempt not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if status != "in_progress" {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "this attempt is already closed", "status": status})
			return
		}

		rows, err := db.QueryContext(ctx,
			`SELECT id, COALESCE(answer, ''), points FROM quiz_questions WHERE quiz_id = ?`, quizID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		type questionRow struct {
			id     string
			answer string
			points int
		}
		questions := []questionRow{}
		for rows.Next() {
			var q questionRow
			if err := rows.Scan(&q.id, &q.answer, &q.points); err != nil {
				rows.Close()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			questions = append(questions, q)
		}
		rows.Close()

		total := 0
		for _, question := range questions {
			given := normalizeAnswer(body.Answers[question.id])
			want := normalizeAnswer(question.answer)
			if given != "" && given == want {
				total += question.points
			}
		}

		finalStatus := "completed"
		if expiresAt.Valid && expiresAt.String != "" {
			if deadline, err := time.Parse(time.RFC3339, expiresAt.String); err == nil && time.Now().UTC().After(deadline) {
				finalStatus = "expired"
			}
		}
		now := util.Now()

		if _, err := db.ExecContext(ctx,
			`UPDATE quiz_attempts SET score = ?, status = ?, completed_at = ? WHERE id = ?`,
			total, finalStatus, now, attemptID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		var maxScore int
		_ = db.QueryRowContext(ctx, `SELECT COALESCE(SUM(points), 0) FROM quiz_questions WHERE quiz_id = ?`, quizID).
			Scan(&maxScore)

		writeJSON(w, http.StatusOK, attemptOut{
			ID: attemptID, QuizID: quizID, Score: total, MaxScore: maxScore,
			Status: finalStatus, CompletedAt: now,
		})
	}
}

// normalizeAnswer makes option indexes, "true"/"false" and free text comparable.
func normalizeAnswer(raw string) string {
	value := strings.TrimSpace(strings.ToLower(raw))
	value = strings.Trim(value, `"'`)
	return value
}

func listQuizAttempts(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		quizID := r.PathValue("id")

		var maxScore int
		_ = db.QueryRowContext(ctx, `SELECT COALESCE(SUM(points), 0) FROM quiz_questions WHERE quiz_id = ?`, quizID).
			Scan(&maxScore)

		query := `
			SELECT a.id, a.quiz_id, COALESCE(a.score, 0), a.status, a.started_at,
			       COALESCE(a.expires_at, ''), COALESCE(a.completed_at, '')
			FROM quiz_attempts a WHERE a.quiz_id = ?`
		args := []any{quizID}
		if studentID := r.URL.Query().Get("student_id"); studentID != "" {
			query += ` AND a.student_id = ?`
			args = append(args, studentID)
		}
		query += ` ORDER BY a.started_at DESC`

		rows, err := db.QueryContext(ctx, query, args...)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		out := []attemptOut{}
		for rows.Next() {
			var a attemptOut
			if err := rows.Scan(&a.ID, &a.QuizID, &a.Score, &a.Status, &a.StartedAt, &a.ExpiresAt, &a.CompletedAt); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			a.MaxScore = maxScore
			a.SecondsLeft = secondsLeft(a.ExpiresAt)
			out = append(out, a)
		}
		writeJSON(w, http.StatusOK, out)
	}
}

// listStudentQuizAttempts feeds the attempt history page (G6).
func listStudentQuizAttempts(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.QueryContext(r.Context(), `
			SELECT a.id, a.quiz_id, q.title, s.id, s.name, COALESCE(a.score, 0),
			       COALESCE((SELECT SUM(qq.points) FROM quiz_questions qq WHERE qq.quiz_id = q.id), 0),
			       a.status, a.started_at, COALESCE(a.expires_at, ''), COALESCE(a.completed_at, '')
			FROM quiz_attempts a
			JOIN quizzes q ON q.id = a.quiz_id
			JOIN subjects s ON s.id = q.subject_id
			WHERE a.student_id = ?
			ORDER BY a.started_at DESC`, r.PathValue("id"))
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		out := []attemptOut{}
		for rows.Next() {
			var a attemptOut
			if err := rows.Scan(&a.ID, &a.QuizID, &a.QuizTitle, &a.SubjectID, &a.SubjectName,
				&a.Score, &a.MaxScore, &a.Status, &a.StartedAt, &a.ExpiresAt, &a.CompletedAt); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			a.SecondsLeft = secondsLeft(a.ExpiresAt)
			out = append(out, a)
		}
		writeJSON(w, http.StatusOK, out)
	}
}

// listQuizQuestions serves the question paper for a timed attempt: options are
// returned, the correct answer never is.
func listQuizQuestions(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.QueryContext(r.Context(), `
			SELECT id, type, prompt, options, points, order_index
			FROM quiz_questions WHERE quiz_id = ? ORDER BY order_index, prompt`, r.PathValue("id"))
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		type questionOut struct {
			ID         string   `json:"id"`
			Type       string   `json:"type"`
			Prompt     string   `json:"prompt"`
			Options    []string `json:"options"`
			Points     int      `json:"points"`
			OrderIndex int      `json:"order_index"`
		}
		out := []questionOut{}
		for rows.Next() {
			var q questionOut
			var optionsJSON string
			if err := rows.Scan(&q.ID, &q.Type, &q.Prompt, &optionsJSON, &q.Points, &q.OrderIndex); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			q.Options = []string{}
			_ = json.Unmarshal([]byte(optionsJSON), &q.Options)
			out = append(out, q)
		}
		writeJSON(w, http.StatusOK, out)
	}
}
