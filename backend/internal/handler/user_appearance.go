package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"

	"smartlms/backend/internal/util"
)

// Per-user appearance (theme + reading font), served to everybody. Scoped by
// user_id until sessions land (same convention as AI settings).
type userAppearanceOut struct {
	UserID    string `json:"user_id"`
	Theme     string `json:"theme"`
	Font      string `json:"font"`
	UpdatedAt string `json:"updated_at,omitempty"`
}

var (
	validThemes = map[string]bool{"system": true, "light": true, "dark": true}
	validFonts  = map[string]bool{"system": true, "legible": true, "dyslexic": true}
)

func loadUserAppearance(ctx context.Context, db *sql.DB, userID string) (userAppearanceOut, error) {
	out := userAppearanceOut{UserID: userID, Theme: "system", Font: "system"}
	err := db.QueryRowContext(ctx,
		`SELECT theme, font, updated_at FROM user_appearance WHERE user_id = ?`, userID).
		Scan(&out.Theme, &out.Font, &out.UpdatedAt)
	if err == sql.ErrNoRows {
		return out, nil
	}
	return out, err
}

func registerUserAppearance(mux *http.ServeMux, db *sql.DB) {
	mux.HandleFunc("GET /api/me/appearance", func(w http.ResponseWriter, r *http.Request) {
		userID := r.URL.Query().Get("user_id")
		if userID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "user_id is required"})
			return
		}
		out, err := loadUserAppearance(r.Context(), db, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, out)
	})

	mux.HandleFunc("PUT /api/me/appearance", func(w http.ResponseWriter, r *http.Request) {
		var req userAppearanceOut
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		switch {
		case req.UserID == "":
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "user_id is required"})
			return
		case !validThemes[req.Theme]:
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "theme must be system, light or dark"})
			return
		case !validFonts[req.Font]:
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "font must be system, legible or dyslexic"})
			return
		}
		if _, err := db.ExecContext(r.Context(), `
			INSERT INTO user_appearance (user_id, theme, font, updated_at)
			VALUES (?, ?, ?, ?)
			ON CONFLICT(user_id) DO UPDATE SET
				theme = excluded.theme, font = excluded.font, updated_at = excluded.updated_at`,
			req.UserID, req.Theme, req.Font, util.Now()); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		out, err := loadUserAppearance(r.Context(), db, req.UserID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, out)
	})
}
