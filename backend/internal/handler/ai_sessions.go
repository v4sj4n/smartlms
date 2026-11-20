package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"smartlms/backend/internal/util"
)

// Assistant chat history: one row per conversation, the UI messages stored
// verbatim as the JSON array useChat holds.

const (
	aiSessionMaxBytes   = 2 << 20
	aiSessionTitleRunes = 60
)

type aiSessionOut struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
	UpdatedAt    string `json:"updated_at"`
	MessageCount int    `json:"message_count"`
}

type aiSessionDetailOut struct {
	aiSessionOut
	Messages json.RawMessage `json:"messages"`
}

type aiSessionListOut struct {
	Items    []aiSessionOut `json:"items"`
	NextPage *int           `json:"next_page"`
}

// deriveSessionTitle: the first user message's text parts, whitespace
// collapsed, cut to 60 runes with an ellipsis when cut.
func deriveSessionTitle(messages []aiUIMessage) string {
	for _, message := range messages {
		if message.Role != "user" {
			continue
		}
		var parts []string
		for _, part := range message.Parts {
			if part.Type == "text" {
				parts = append(parts, part.Text)
			}
		}
		title := strings.Join(strings.Fields(strings.Join(parts, " ")), " ")
		if title == "" {
			continue
		}
		if utf8.RuneCountInString(title) > aiSessionTitleRunes {
			runes := []rune(title)
			title = strings.TrimRight(string(runes[:aiSessionTitleRunes]), " ") + "…"
		}
		return title
	}
	return ""
}

func loadAISession(ctx context.Context, db *sql.DB, id, userID string) (aiSessionOut, error) {
	var out aiSessionOut
	err := db.QueryRowContext(ctx, `
		SELECT id, title, updated_at, message_count FROM ai_chat_sessions
		WHERE id = ? AND user_id = ?`, id, userID).Scan(
		&out.ID, &out.Title, &out.UpdatedAt, &out.MessageCount)
	return out, err
}

func registerAISessions(mux *http.ServeMux, db *sql.DB) {
	notFound := func(w http.ResponseWriter) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "chat not found"})
	}
	userRequired := func(w http.ResponseWriter) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "user_id is required"})
	}
	serverError := func(w http.ResponseWriter, message string) {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": message})
	}

	mux.HandleFunc("GET /api/ai/sessions", func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query()
		userID := strings.TrimSpace(query.Get("user_id"))
		if userID == "" {
			userRequired(w)
			return
		}
		page, _ := strconv.Atoi(query.Get("page"))
		if page < 1 {
			page = 1
		}
		limit, _ := strconv.Atoi(query.Get("limit"))
		if limit < 1 {
			limit = 15
		}
		if limit > 50 {
			limit = 50
		}
		// One extra row tells us whether another page exists.
		rows, err := db.QueryContext(r.Context(), `
			SELECT id, title, updated_at, message_count FROM ai_chat_sessions
			WHERE user_id = ? AND message_count > 0
			ORDER BY updated_at DESC, created_at DESC, id DESC
			LIMIT ? OFFSET ?`, userID, limit+1, (page-1)*limit)
		if err != nil {
			serverError(w, "Chats could not be listed.")
			return
		}
		defer rows.Close()
		out := aiSessionListOut{Items: []aiSessionOut{}}
		for rows.Next() {
			var item aiSessionOut
			if err := rows.Scan(&item.ID, &item.Title, &item.UpdatedAt, &item.MessageCount); err != nil {
				serverError(w, "Chats could not be listed.")
				return
			}
			out.Items = append(out.Items, item)
		}
		if err := rows.Err(); err != nil {
			serverError(w, "Chats could not be listed.")
			return
		}
		if len(out.Items) > limit {
			out.Items = out.Items[:limit]
			next := page + 1
			out.NextPage = &next
		}
		writeJSON(w, http.StatusOK, out)
	})

	mux.HandleFunc("POST /api/ai/sessions", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			UserID string `json:"user_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		userID := strings.TrimSpace(body.UserID)
		if userID == "" {
			userRequired(w)
			return
		}
		ctx := r.Context()
		var exists int
		if err := db.QueryRowContext(ctx, `SELECT 1 FROM users WHERE id = ?`, userID).Scan(&exists); err == sql.ErrNoRows {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unknown user"})
			return
		} else if err != nil {
			serverError(w, "The chat could not be created.")
			return
		}
		id, now := util.NewID(), util.Now()
		if _, err := db.ExecContext(ctx, `
			INSERT INTO ai_chat_sessions (id, user_id, created_at, updated_at)
			VALUES (?, ?, ?, ?)`, id, userID, now, now); err != nil {
			serverError(w, "The chat could not be created.")
			return
		}
		writeJSON(w, http.StatusCreated, aiSessionOut{ID: id, UpdatedAt: now})
	})

	mux.HandleFunc("GET /api/ai/sessions/{id}", func(w http.ResponseWriter, r *http.Request) {
		userID := strings.TrimSpace(r.URL.Query().Get("user_id"))
		if userID == "" {
			userRequired(w)
			return
		}
		var out aiSessionDetailOut
		var messages string
		err := db.QueryRowContext(r.Context(), `
			SELECT id, title, updated_at, message_count, messages FROM ai_chat_sessions
			WHERE id = ? AND user_id = ?`, r.PathValue("id"), userID).Scan(
			&out.ID, &out.Title, &out.UpdatedAt, &out.MessageCount, &messages)
		if err == sql.ErrNoRows {
			notFound(w)
			return
		}
		if err != nil {
			serverError(w, "The chat could not be loaded.")
			return
		}
		out.Messages = json.RawMessage(messages)
		writeJSON(w, http.StatusOK, out)
	})

	mux.HandleFunc("PUT /api/ai/sessions/{id}/messages", func(w http.ResponseWriter, r *http.Request) {
		raw, err := io.ReadAll(io.LimitReader(r.Body, aiSessionMaxBytes+64<<10))
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
			return
		}
		var body struct {
			UserID   string          `json:"user_id"`
			Messages json.RawMessage `json:"messages"`
		}
		if err := json.Unmarshal(raw, &body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		userID := strings.TrimSpace(body.UserID)
		if userID == "" {
			userRequired(w)
			return
		}
		if len(body.Messages) > aiSessionMaxBytes {
			writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "messages exceed 2MB"})
			return
		}
		var elements []json.RawMessage
		if len(body.Messages) == 0 || json.Unmarshal(body.Messages, &elements) != nil || elements == nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "messages must be a JSON array"})
			return
		}
		// Typed view only for the title; the stored array stays verbatim.
		var typed []aiUIMessage
		_ = json.Unmarshal(body.Messages, &typed)

		ctx := r.Context()
		id := r.PathValue("id")
		current, err := loadAISession(ctx, db, id, userID)
		if err == sql.ErrNoRows {
			notFound(w)
			return
		}
		if err != nil {
			serverError(w, "The chat could not be saved.")
			return
		}
		title := current.Title
		if title == "" {
			title = deriveSessionTitle(typed)
		}
		now := util.Now()
		if _, err := db.ExecContext(ctx, `
			UPDATE ai_chat_sessions SET messages = ?, message_count = ?, title = ?, updated_at = ?
			WHERE id = ? AND user_id = ?`,
			string(body.Messages), len(elements), title, now, id, userID); err != nil {
			serverError(w, "The chat could not be saved.")
			return
		}
		writeJSON(w, http.StatusOK, aiSessionOut{ID: id, Title: title, UpdatedAt: now, MessageCount: len(elements)})
	})

	mux.HandleFunc("DELETE /api/ai/sessions/{id}", func(w http.ResponseWriter, r *http.Request) {
		userID := strings.TrimSpace(r.URL.Query().Get("user_id"))
		if userID == "" {
			userRequired(w)
			return
		}
		result, err := db.ExecContext(r.Context(),
			`DELETE FROM ai_chat_sessions WHERE id = ? AND user_id = ?`, r.PathValue("id"), userID)
		if err != nil {
			serverError(w, "The chat could not be deleted.")
			return
		}
		if n, _ := result.RowsAffected(); n == 0 {
			notFound(w)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
}
