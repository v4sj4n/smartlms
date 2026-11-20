package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"sort"
	"strings"

	"smartlms/backend/internal/util"
)

// An MCP app is an external service the assistant can act through on the
// user's behalf. The catalog is shared by everybody; a connection is per
// person, and that row is what the profile draws as an avatar.
type mcpAppOut struct {
	Key         string   `json:"key"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Category    string   `json:"category"`
	Glyph       string   `json:"glyph"`
	Tone        string   `json:"tone"`
	Scopes      []string `json:"scopes"`
	Connected   bool     `json:"connected"`
	ConnectedAt string   `json:"connected_at,omitempty"`
	LastUsedAt  string   `json:"last_used_at,omitempty"`
}

// Connected apps first (newest connection first), then the ones still on offer.
type mcpAppListOut struct {
	Connected []mcpAppOut `json:"connected"`
	Available []mcpAppOut `json:"available"`
}

func decodeScopes(raw string) []string {
	scopes := []string{}
	if strings.TrimSpace(raw) == "" {
		return scopes
	}
	if err := json.Unmarshal([]byte(raw), &scopes); err != nil {
		return []string{}
	}
	return scopes
}

// loadMcpApps reads the whole catalog with this user's connections folded in.
func loadMcpApps(ctx context.Context, db *sql.DB, userID string) (mcpAppListOut, error) {
	out := mcpAppListOut{Connected: []mcpAppOut{}, Available: []mcpAppOut{}}

	rows, err := db.QueryContext(ctx, `
		SELECT a.key, a.name, a.description, a.category, a.glyph, a.tone, a.scopes,
		       COALESCE(c.connected_at, ''), COALESCE(c.last_used_at, '')
		FROM mcp_apps a
		LEFT JOIN user_mcp_apps c ON c.app_key = a.key AND c.user_id = ?
		ORDER BY a.name`, userID)
	if err != nil {
		return out, err
	}
	defer rows.Close()

	for rows.Next() {
		var (
			item     mcpAppOut
			rawScope string
		)
		if err := rows.Scan(
			&item.Key, &item.Name, &item.Description, &item.Category,
			&item.Glyph, &item.Tone, &rawScope,
			&item.ConnectedAt, &item.LastUsedAt,
		); err != nil {
			return out, err
		}
		item.Scopes = decodeScopes(rawScope)
		item.Connected = item.ConnectedAt != ""
		if item.Connected {
			out.Connected = append(out.Connected, item)
		} else {
			out.Available = append(out.Available, item)
		}
	}
	if err := rows.Err(); err != nil {
		return out, err
	}

	sort.SliceStable(out.Connected, func(i, j int) bool {
		return out.Connected[i].ConnectedAt > out.Connected[j].ConnectedAt
	})
	return out, nil
}

// userExists keeps a stray user_id from creating an orphan connection.
func userExists(ctx context.Context, db *sql.DB, userID string) (bool, error) {
	var found string
	err := db.QueryRowContext(ctx, `SELECT id FROM users WHERE id = ?`, userID).Scan(&found)
	if err == sql.ErrNoRows {
		return false, nil
	}
	return err == nil, err
}

func registerUserMcpApps(mux *http.ServeMux, db *sql.DB) {
	// GET /api/me/mcp-apps?user_id= — connected apps plus the rest of the catalog.
	mux.HandleFunc("GET /api/me/mcp-apps", func(w http.ResponseWriter, r *http.Request) {
		userID := strings.TrimSpace(r.URL.Query().Get("user_id"))
		if userID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "user_id is required"})
			return
		}
		exists, err := userExists(r.Context(), db, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if !exists {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
			return
		}
		out, err := loadMcpApps(r.Context(), db, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, out)
	})

	// POST /api/me/mcp-apps — connect an app for a user. Connecting twice is a
	// no-op, so a double click cannot produce two rows.
	mux.HandleFunc("POST /api/me/mcp-apps", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			UserID string `json:"user_id"`
			AppKey string `json:"app_key"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		req.UserID = strings.TrimSpace(req.UserID)
		req.AppKey = strings.TrimSpace(req.AppKey)
		switch {
		case req.UserID == "":
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "user_id is required"})
			return
		case req.AppKey == "":
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "app_key is required"})
			return
		}

		exists, err := userExists(r.Context(), db, req.UserID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if !exists {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
			return
		}

		var known string
		if err := db.QueryRowContext(r.Context(),
			`SELECT key FROM mcp_apps WHERE key = ?`, req.AppKey).Scan(&known); err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "unknown app: " + req.AppKey})
			return
		} else if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		if _, err := db.ExecContext(r.Context(), `
			INSERT OR IGNORE INTO user_mcp_apps (user_id, app_key, connected_at)
			VALUES (?, ?, ?)`, req.UserID, req.AppKey, util.Now()); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		out, err := loadMcpApps(r.Context(), db, req.UserID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, out)
	})

	// DELETE /api/me/mcp-apps/{key}?user_id= — revoke an app's access.
	mux.HandleFunc("DELETE /api/me/mcp-apps/{key}", func(w http.ResponseWriter, r *http.Request) {
		userID := strings.TrimSpace(r.URL.Query().Get("user_id"))
		appKey := strings.TrimSpace(r.PathValue("key"))
		switch {
		case userID == "":
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "user_id is required"})
			return
		case appKey == "":
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "app key is required"})
			return
		}

		if _, err := db.ExecContext(r.Context(),
			`DELETE FROM user_mcp_apps WHERE user_id = ? AND app_key = ?`, userID, appKey); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		out, err := loadMcpApps(r.Context(), db, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, out)
	})
}
