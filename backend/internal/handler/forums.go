package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	"smartlms/backend/internal/util"
)

/* ============================================================================
   COURSE FORUMS (A7)
   A forum belongs to a subject. Lecturers start the topics, enrolled students
   reply. No subscriptions or digests in this pass, by design.
   ========================================================================== */

type forumOut struct {
	ID           string `json:"id"`
	SubjectID    string `json:"subject_id"`
	Title        string `json:"title"`
	Description  string `json:"description,omitempty"`
	IsLocked     bool   `json:"is_locked"`
	ThreadCount  int    `json:"thread_count"`
	PostCount    int    `json:"post_count"`
	LastActivity string `json:"last_activity,omitempty"`
}

type threadOut struct {
	ID         string `json:"id"`
	ForumID    string `json:"forum_id"`
	Title      string `json:"title"`
	Body       string `json:"body"`
	AuthorID   string `json:"author_id"`
	AuthorName string `json:"author_name"`
	AuthorRole string `json:"author_role"`
	IsPinned   bool   `json:"is_pinned"`
	IsLocked   bool   `json:"is_locked"`
	ReplyCount int    `json:"reply_count"`
	LastPostAt string `json:"last_post_at"`
	CreatedAt  string `json:"created_at"`
}

type postOut struct {
	ID         string `json:"id"`
	ThreadID   string `json:"thread_id"`
	AuthorID   string `json:"author_id"`
	AuthorName string `json:"author_name"`
	AuthorRole string `json:"author_role"`
	Body       string `json:"body"`
	CreatedAt  string `json:"created_at"`
}

func registerForums(mux *http.ServeMux, db *sql.DB) {
	mux.HandleFunc("GET /api/subjects/{id}/forums", listForums(db))
	mux.HandleFunc("POST /api/subjects/{id}/forums", createForum(db))
	mux.HandleFunc("GET /api/forums/{id}/threads", listThreads(db))
	mux.HandleFunc("POST /api/forums/{id}/threads", createThread(db))
	mux.HandleFunc("GET /api/threads/{id}", getThread(db))
	mux.HandleFunc("PATCH /api/threads/{id}", patchThread(db))
	mux.HandleFunc("POST /api/threads/{id}/posts", createPost(db))
	mux.HandleFunc("DELETE /api/posts/{id}", deletePost(db))
}

func listForums(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.QueryContext(r.Context(), `
			SELECT f.id, f.subject_id, f.title, COALESCE(f.description, ''), f.is_locked,
			       (SELECT COUNT(*) FROM forum_threads t WHERE t.forum_id = f.id),
			       (SELECT COUNT(*) FROM forum_posts p JOIN forum_threads t ON t.id = p.thread_id
			         WHERE t.forum_id = f.id AND p.deleted_at IS NULL),
			       COALESCE((SELECT MAX(t.last_post_at) FROM forum_threads t WHERE t.forum_id = f.id), '')
			FROM forums f WHERE f.subject_id = ? ORDER BY f.title`, r.PathValue("id"))
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		out := []forumOut{}
		for rows.Next() {
			var f forumOut
			if err := rows.Scan(&f.ID, &f.SubjectID, &f.Title, &f.Description, &f.IsLocked,
				&f.ThreadCount, &f.PostCount, &f.LastActivity); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			out = append(out, f)
		}
		writeJSON(w, http.StatusOK, out)
	}
}

func createForum(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		subjectID := r.PathValue("id")

		var body struct {
			UserID      string `json:"user_id"`
			Title       string `json:"title"`
			Description string `json:"description"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		if err := requireSubjectStaff(ctx, db, body.UserID, subjectID); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}
		if strings.TrimSpace(body.Title) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "title is required"})
			return
		}

		id, now := util.NewID(), util.Now()
		if _, err := db.ExecContext(ctx, `
			INSERT INTO forums (id, subject_id, title, description, is_locked, created_by, created_at, updated_at)
			VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
			id, subjectID, strings.TrimSpace(body.Title), body.Description, nullIfEmpty(body.UserID), now, now); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusCreated, forumOut{
			ID: id, SubjectID: subjectID, Title: strings.TrimSpace(body.Title), Description: body.Description,
		})
	}
}

func listThreads(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.QueryContext(r.Context(), `
			SELECT t.id, t.forum_id, t.title, t.body, t.author_id, COALESCE(u.name, ''), COALESCE(r.name, ''),
			       t.is_pinned, t.is_locked,
			       (SELECT COUNT(*) FROM forum_posts p WHERE p.thread_id = t.id AND p.deleted_at IS NULL),
			       t.last_post_at, t.created_at
			FROM forum_threads t
			LEFT JOIN users u ON u.id = t.author_id
			LEFT JOIN roles r ON r.id = u.role_id
			WHERE t.forum_id = ?
			ORDER BY t.is_pinned DESC, t.last_post_at DESC`, r.PathValue("id"))
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		out := []threadOut{}
		for rows.Next() {
			var t threadOut
			if err := rows.Scan(&t.ID, &t.ForumID, &t.Title, &t.Body, &t.AuthorID, &t.AuthorName, &t.AuthorRole,
				&t.IsPinned, &t.IsLocked, &t.ReplyCount, &t.LastPostAt, &t.CreatedAt); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			out = append(out, t)
		}
		writeJSON(w, http.StatusOK, out)
	}
}

// createThread opens a topic. Only the subject's lecturer (or an admin) can
// start one; students reply instead.
func createThread(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		forumID := r.PathValue("id")

		var subjectID string
		var forumLocked bool
		err := db.QueryRowContext(ctx, `SELECT subject_id, is_locked FROM forums WHERE id = ?`, forumID).
			Scan(&subjectID, &forumLocked)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "forum not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		var body struct {
			UserID string `json:"user_id"`
			Title  string `json:"title"`
			Body   string `json:"body"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		if err := requireSubjectStaff(ctx, db, body.UserID, subjectID); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}
		if forumLocked {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "this forum is locked"})
			return
		}
		if strings.TrimSpace(body.Title) == "" || strings.TrimSpace(body.Body) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "title and body are required"})
			return
		}

		id, now := util.NewID(), util.Now()
		if _, err := db.ExecContext(ctx, `
			INSERT INTO forum_threads (id, forum_id, title, body, author_id, is_pinned, is_locked, last_post_at, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?)`,
			id, forumID, strings.TrimSpace(body.Title), strings.TrimSpace(body.Body), body.UserID, now, now, now); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusCreated, map[string]string{"id": id})
	}
}

func getThread(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		threadID := r.PathValue("id")

		var t threadOut
		err := db.QueryRowContext(ctx, `
			SELECT t.id, t.forum_id, t.title, t.body, t.author_id, COALESCE(u.name, ''), COALESCE(r.name, ''),
			       t.is_pinned, t.is_locked,
			       (SELECT COUNT(*) FROM forum_posts p WHERE p.thread_id = t.id AND p.deleted_at IS NULL),
			       t.last_post_at, t.created_at
			FROM forum_threads t
			LEFT JOIN users u ON u.id = t.author_id
			LEFT JOIN roles r ON r.id = u.role_id
			WHERE t.id = ?`, threadID).
			Scan(&t.ID, &t.ForumID, &t.Title, &t.Body, &t.AuthorID, &t.AuthorName, &t.AuthorRole,
				&t.IsPinned, &t.IsLocked, &t.ReplyCount, &t.LastPostAt, &t.CreatedAt)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "thread not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		rows, err := db.QueryContext(ctx, `
			SELECT p.id, p.thread_id, p.author_id, COALESCE(u.name, ''), COALESCE(r.name, ''), p.body, p.created_at
			FROM forum_posts p
			LEFT JOIN users u ON u.id = p.author_id
			LEFT JOIN roles r ON r.id = u.role_id
			WHERE p.thread_id = ? AND p.deleted_at IS NULL
			ORDER BY p.created_at`, threadID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		posts := []postOut{}
		for rows.Next() {
			var p postOut
			if err := rows.Scan(&p.ID, &p.ThreadID, &p.AuthorID, &p.AuthorName, &p.AuthorRole, &p.Body, &p.CreatedAt); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			posts = append(posts, p)
		}

		writeJSON(w, http.StatusOK, map[string]any{"thread": t, "posts": posts})
	}
}

func patchThread(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		threadID := r.PathValue("id")

		var subjectID string
		err := db.QueryRowContext(ctx, `
			SELECT f.subject_id FROM forum_threads t JOIN forums f ON f.id = t.forum_id WHERE t.id = ?`, threadID).
			Scan(&subjectID)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "thread not found"})
			return
		}

		var body struct {
			UserID   string `json:"user_id"`
			IsPinned *bool  `json:"is_pinned"`
			IsLocked *bool  `json:"is_locked"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		if err := requireSubjectStaff(ctx, db, body.UserID, subjectID); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}

		var b setBuilder
		if body.IsPinned != nil {
			if *body.IsPinned {
				b.set("is_pinned", 1)
			} else {
				b.set("is_pinned", 0)
			}
		}
		if body.IsLocked != nil {
			if *body.IsLocked {
				b.set("is_locked", 1)
			} else {
				b.set("is_locked", 0)
			}
		}
		if b.empty() {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "nothing to update"})
			return
		}
		if _, err := b.updateRow(ctx, db, "forum_threads", threadID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// createPost adds a reply. Enrolled students and subject staff may reply to an
// unlocked thread.
func createPost(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		threadID := r.PathValue("id")

		var subjectID string
		var threadLocked, forumLocked bool
		err := db.QueryRowContext(ctx, `
			SELECT f.subject_id, t.is_locked, f.is_locked
			FROM forum_threads t JOIN forums f ON f.id = t.forum_id
			WHERE t.id = ?`, threadID).Scan(&subjectID, &threadLocked, &forumLocked)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "thread not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if threadLocked || forumLocked {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "this thread is locked"})
			return
		}

		var body struct {
			UserID string `json:"user_id"`
			Body   string `json:"body"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		if strings.TrimSpace(body.Body) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "body is required"})
			return
		}

		role, err := roleOf(ctx, db, body.UserID)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown user"})
			return
		}
		if role != "ADMIN" && role != "LECTURER" {
			var enrolled int
			if err := db.QueryRowContext(ctx,
				`SELECT COUNT(*) FROM enrollments WHERE subject_id = ? AND student_id = ?`,
				subjectID, body.UserID).Scan(&enrolled); err != nil || enrolled == 0 {
				writeJSON(w, http.StatusForbidden, map[string]string{"error": "you are not enrolled in this subject"})
				return
			}
		}

		id, now := util.NewID(), util.Now()
		if _, err := db.ExecContext(ctx, `
			INSERT INTO forum_posts (id, thread_id, author_id, body, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?)`,
			id, threadID, body.UserID, strings.TrimSpace(body.Body), now, now); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if _, err := db.ExecContext(ctx,
			`UPDATE forum_threads SET last_post_at = ?, updated_at = ? WHERE id = ?`, now, now, threadID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusCreated, map[string]string{"id": id})
	}
}

// deletePost soft-deletes a reply: the author or the subject's staff.
func deletePost(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		postID := r.PathValue("id")
		userID := r.URL.Query().Get("user_id")
		if userID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "user_id is required"})
			return
		}

		var authorID, subjectID string
		err := db.QueryRowContext(ctx, `
			SELECT p.author_id, f.subject_id
			FROM forum_posts p
			JOIN forum_threads t ON t.id = p.thread_id
			JOIN forums f ON f.id = t.forum_id
			WHERE p.id = ?`, postID).Scan(&authorID, &subjectID)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "post not found"})
			return
		}

		if authorID != userID {
			if err := requireSubjectStaff(ctx, db, userID, subjectID); err != nil {
				writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
				return
			}
		}

		if _, err := db.ExecContext(ctx,
			`UPDATE forum_posts SET deleted_at = ?, updated_at = ? WHERE id = ?`, util.Now(), util.Now(), postID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
