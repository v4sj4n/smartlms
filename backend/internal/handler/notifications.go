package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"smartlms/backend/internal/util"
)

type notificationOut struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Message   string `json:"message"`
	Read      bool   `json:"read"`
	CreatedAt string `json:"created_at"`
}

// registerNotifications wires the in-app notification feed shown in the user
// menu. Scoped by user_id until sessions land.
func registerNotifications(mux *http.ServeMux, db *sql.DB) {
	mux.HandleFunc("GET /api/notifications", func(w http.ResponseWriter, r *http.Request) {
		userID := r.URL.Query().Get("user_id")
		if userID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "user_id is required"})
			return
		}
		rows, err := db.QueryContext(r.Context(), `
			SELECT id, title, message, read_at IS NOT NULL, created_at
			FROM notifications WHERE user_id = ?
			ORDER BY (read_at IS NULL) DESC, created_at DESC`, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()
		out := []notificationOut{}
		for rows.Next() {
			var n notificationOut
			if err := rows.Scan(&n.ID, &n.Title, &n.Message, &n.Read, &n.CreatedAt); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			out = append(out, n)
		}
		writeJSON(w, http.StatusOK, out)
	})

	mux.HandleFunc("POST /api/notifications/{id}/read", func(w http.ResponseWriter, r *http.Request) {
		res, err := db.ExecContext(r.Context(), `UPDATE notifications SET read_at = ? WHERE id = ? AND read_at IS NULL`,
			util.Now(), r.PathValue("id"))
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			// already read or missing: both are fine for the caller
			writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	mux.HandleFunc("POST /api/notifications/read-all", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			UserID string `json:"user_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.UserID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "user_id is required"})
			return
		}
		if _, err := db.ExecContext(r.Context(), `UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL`,
			util.Now(), body.UserID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
}
