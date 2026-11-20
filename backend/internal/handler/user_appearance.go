package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"

	"optimolms/backend/internal/util"
)

// Per-user appearance (theme, reading font, accent, contrast), served to everybody. The session
// names the person; the body carries only the preferences.
type userAppearanceOut struct {
	UserID    string `json:"user_id"`
	Theme     string `json:"theme"`
	Font      string `json:"font"`
	Accent    string `json:"accent"`
	Contrast  string `json:"contrast"`
	UpdatedAt string `json:"updated_at,omitempty"`
}

var (
	validThemes = map[string]bool{"system": true, "light": true, "dark": true}
	validFonts  = map[string]bool{"system": true, "legible": true, "dyslexic": true}
	// Mirrors ACCENTS in frontend/scripts/accents.mjs.
	validAccents = map[string]bool{
		"blue": true, "teal": true, "green": true, "yellow": true,
		"orange": true, "red": true, "pink": true, "violet": true,
	}
	validContrasts = map[string]bool{"system": true, "high": true}
)

func loadUserAppearance(ctx context.Context, db *sql.DB, userID string) (userAppearanceOut, error) {
	out := userAppearanceOut{UserID: userID, Theme: "system", Font: "system", Accent: "blue", Contrast: "system"}
	err := db.QueryRowContext(ctx,
		`SELECT theme, font, accent, contrast, updated_at FROM user_appearance WHERE user_id = ?`, userID).
		Scan(&out.Theme, &out.Font, &out.Accent, &out.Contrast, &out.UpdatedAt)
	if err == sql.ErrNoRows {
		return out, nil
	}
	return out, err
}

func registerUserAppearance(mux *http.ServeMux, db *sql.DB) {
	mux.HandleFunc("GET /api/me/appearance", func(w http.ResponseWriter, r *http.Request) {
		out, err := loadUserAppearance(r.Context(), db, callerFrom(r).ID)
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
		// Whose appearance this is comes from the session; the body only carries
		// the choices.
		userID := callerFrom(r).ID
		req.UserID = userID
		// Clients that predate accent and contrast leave them out.
		if req.Accent == "" {
			req.Accent = "blue"
		}
		if req.Contrast == "" {
			req.Contrast = "system"
		}
		switch {
		case !validThemes[req.Theme]:
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "theme must be system, light or dark"})
			return
		case !validFonts[req.Font]:
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "font must be system, legible or dyslexic"})
			return
		case !validAccents[req.Accent]:
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "accent must be blue, teal, green, yellow, orange, red, pink or violet"})
			return
		case !validContrasts[req.Contrast]:
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "contrast must be system or high"})
			return
		}
		if _, err := db.ExecContext(r.Context(), `
			INSERT INTO user_appearance (user_id, theme, font, accent, contrast, updated_at)
			VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT(user_id) DO UPDATE SET
				theme = excluded.theme, font = excluded.font, accent = excluded.accent,
				contrast = excluded.contrast, updated_at = excluded.updated_at`,
			userID, req.Theme, req.Font, req.Accent, req.Contrast, util.Now()); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		out, err := loadUserAppearance(r.Context(), db, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, out)
	})
}
