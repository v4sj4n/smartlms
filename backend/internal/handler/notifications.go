package handler

import (
	"database/sql"
	"net/http"

	"optimolms/backend/internal/util"
)

type notificationOut struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Message   string `json:"message"`
	Read      bool   `json:"read"`
	CreatedAt string `json:"created_at"`
}

// registerNotifications wires the in-app notification feed shown in the user
// menu. The session decides whose feed it is.
func registerNotifications(mux *http.ServeMux, db *sql.DB) {
	mux.HandleFunc("GET /api/notifications", func(w http.ResponseWriter, r *http.Request) {
		userID := callerFrom(r).ID
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
		// Scoped by owner: a notification id alone is not permission to touch it.
		res, err := db.ExecContext(r.Context(),
			`UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL`,
			util.Now(), r.PathValue("id"), callerFrom(r).ID)
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
		if _, err := db.ExecContext(r.Context(), `UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL`,
			util.Now(), callerFrom(r).ID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
}
