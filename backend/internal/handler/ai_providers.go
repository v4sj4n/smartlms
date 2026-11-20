package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"

	"optimolms/backend/internal/keycrypt"
	"optimolms/backend/internal/util"
)

// OpenAI-compatible endpoints, either institutional (admin-managed) or
// personal (one per user). Keys are stored encrypted; responses carry only a
// masked hint. The caller comes from the session, so "personal" always means
// the person making the request.
type aiProviderOut struct {
	ID           string `json:"id"`
	Scope        string `json:"scope"`
	Name         string `json:"name"`
	BaseURL      string `json:"base_url"`
	IsEnabled    bool   `json:"is_enabled"`
	HasKey       bool   `json:"has_key"`
	KeyHint      string `json:"key_hint,omitempty"`
	DefaultModel string `json:"default_model,omitempty"`
	ModelCount   int    `json:"model_count"`
	// EnabledModelCount is how many of those models chat may pick from.
	EnabledModelCount int `json:"enabled_model_count"`
	// Last verification outcome, so the list can show a status pill:
	// "" (never checked), ok, no_models, invalid_key, unreachable, timeout,
	// endpoint_missing or rate_limited.
	Health       string `json:"health"`
	HealthDetail string `json:"health_detail,omitempty"`
	CheckedAt    string `json:"checked_at,omitempty"`
}

type aiModelOut struct {
	ID        string `json:"id"`
	ModelID   string `json:"model_id"`
	IsEnabled bool   `json:"is_enabled"`
}

const (
	maxProviderName = 80
	maxBaseURL      = 300
	maxAPIKeyLength = 400
)

// roleOf reads the user's role name, used to expand ADMIN module access.
func roleOf(ctx context.Context, db *sql.DB, userID string) (string, error) {
	var role string
	err := db.QueryRowContext(ctx, `SELECT r.name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`, userID).
		Scan(&role)
	return role, err
}

type providerRow struct {
	ID           string
	Scope        string
	OwnerUserID  sql.NullString
	BaseURL      string
	APIKeyCipher sql.NullString
	KeyHint      string
	IsEnabled    bool
	DefaultModel string
}

func loadProvider(ctx context.Context, db *sql.DB, id string) (providerRow, error) {
	var row providerRow
	err := db.QueryRowContext(ctx, `
		SELECT id, scope, owner_user_id, base_url, api_key_cipher, key_hint, is_enabled, default_model
		FROM ai_providers WHERE id = ?`, id).
		Scan(&row.ID, &row.Scope, &row.OwnerUserID, &row.BaseURL,
			&row.APIKeyCipher, &row.KeyHint, &row.IsEnabled, &row.DefaultModel)
	return row, err
}

// canManage: institutional providers need the assistant.configure permission;
// personal providers are managed only by their owner.
func canManage(ctx context.Context, db *sql.DB, row providerRow, userID string) (bool, error) {
	if row.Scope == "personal" {
		return row.OwnerUserID.Valid && row.OwnerUserID.String == userID, nil
	}
	return userHasPermission(ctx, db, userID, PermAssistantConfigure)
}

// configureDenied returns the status and message when userID may not touch
// institutional providers, or 0 when it may.
func configureDenied(ctx context.Context, db *sql.DB, userID string) (int, string) {
	allowed, err := userHasPermission(ctx, db, userID, PermAssistantConfigure)
	if err == sql.ErrNoRows {
		return http.StatusUnauthorized, "unknown user"
	}
	if err != nil {
		return http.StatusInternalServerError, err.Error()
	}
	if !allowed {
		return http.StatusForbidden, "institutional providers need the " + PermAssistantConfigure + " permission"
	}
	return 0, ""
}

func registerAIProviders(mux *http.ServeMux, db *sql.DB, crypt *keycrypt.Crypt) {
	mux.HandleFunc("GET /api/ai/providers", func(w http.ResponseWriter, r *http.Request) {
		userID := callerFrom(r).ID
		scope := r.URL.Query().Get("scope")
		if scope != "institutional" && scope != "personal" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "scope must be institutional or personal"})
			return
		}
		if scope == "institutional" {
			if status, message := configureDenied(r.Context(), db, userID); status != 0 {
				writeJSON(w, status, map[string]string{"error": message})
				return
			}
		}

		rows, err := db.QueryContext(r.Context(), providerSelect+`
			FROM ai_providers p
			WHERE p.scope = ? AND (p.owner_user_id IS NULL OR p.owner_user_id = ?)
			ORDER BY p.name`,
			scope, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		items := []aiProviderOut{}
		for rows.Next() {
			p, err := scanProviderOut(rows)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			items = append(items, p)
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items})
	})

	mux.HandleFunc("POST /api/ai/providers", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Scope   string `json:"scope"`
			Name    string `json:"name"`
			BaseURL string `json:"base_url"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		userID := callerFrom(r).ID
		req.Name = strings.TrimSpace(req.Name)
		req.BaseURL = strings.TrimRight(strings.TrimSpace(req.BaseURL), "/")
		if req.Scope == "" {
			req.Scope = "personal"
		}
		if req.Name == "" || len(req.Name) > maxProviderName {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "A provider name of up to 80 characters is required"})
			return
		}
		parsed, err := url.Parse(req.BaseURL)
		if err != nil || len(req.BaseURL) > maxBaseURL ||
			(parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "base_url must be a valid http(s) endpoint"})
			return
		}

		ctx := r.Context()
		if req.Scope == "personal" {
			// One personal provider per user; re-adding replaces nothing, the
			// existing card must be edited or deleted first.
			var count int
			if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM ai_providers WHERE scope = 'personal' AND owner_user_id = ?`, userID).Scan(&count); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			if count >= 1 {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "You already have a personal provider. Edit or delete it first."})
				return
			}
		} else if req.Scope != "institutional" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "scope must be institutional or personal"})
			return
		} else {
			if status, message := configureDenied(ctx, db, userID); status != 0 {
				writeJSON(w, status, map[string]string{"error": message})
				return
			}
		}

		id, now := util.NewID(), util.Now()
		var owner any
		if req.Scope == "personal" {
			owner = userID
		}
		if _, err := db.ExecContext(ctx, `
			INSERT INTO ai_providers (id, scope, owner_user_id, name, base_url, is_enabled, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
			id, req.Scope, owner, req.Name, req.BaseURL, now, now); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusCreated, aiProviderOut{
			ID: id, Scope: req.Scope, Name: req.Name, BaseURL: req.BaseURL, ModelCount: 0,
		})
	})

	mux.HandleFunc("PATCH /api/ai/providers/{id}", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			IsEnabled    *bool  `json:"is_enabled"`
			DefaultModel string `json:"default_model"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		ctx := r.Context()
		userID := callerFrom(r).ID
		row, err := loadProvider(ctx, db, r.PathValue("id"))
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "provider not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		allowed, err := canManage(ctx, db, row, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if !allowed {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "you cannot manage this provider"})
			return
		}

		if req.IsEnabled != nil {
			if _, err := db.ExecContext(ctx, `UPDATE ai_providers SET is_enabled = ?, updated_at = ? WHERE id = ?`,
				*req.IsEnabled, util.Now(), row.ID); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
		}
		if req.DefaultModel != "" {
			// Defaults must point at an actual model of this provider, and
			// picking one switches it on.
			var count int
			if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM ai_models WHERE provider_id = ? AND model_id = ?`,
				row.ID, req.DefaultModel).Scan(&count); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			if count == 0 {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown model for this provider"})
				return
			}
			tx, err := db.BeginTx(ctx, nil)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			if err := pinDefault(ctx, tx, row.ID, req.DefaultModel); err != nil {
				_ = tx.Rollback()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			if err := tx.Commit(); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
		}

		updated, err := loadProviderOut(ctx, db, row.ID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, updated)
	})

	mux.HandleFunc("DELETE /api/ai/providers/{id}", func(w http.ResponseWriter, r *http.Request) {
		userID := callerFrom(r).ID
		ctx := r.Context()
		row, err := loadProvider(ctx, db, r.PathValue("id"))
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "provider not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		allowed, err := canManage(ctx, db, row, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if !allowed {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "you cannot manage this provider"})
			return
		}
		if _, err := db.ExecContext(ctx, `DELETE FROM ai_providers WHERE id = ?`, row.ID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	mux.HandleFunc("GET /api/ai/providers/{id}/models", func(w http.ResponseWriter, r *http.Request) {
		userID := callerFrom(r).ID
		ctx := r.Context()
		row, err := loadProvider(ctx, db, r.PathValue("id"))
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "provider not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		allowed, err := canManage(ctx, db, row, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if !allowed {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "you cannot manage this provider"})
			return
		}

		rows, err := db.QueryContext(ctx, `SELECT id, model_id, is_enabled FROM ai_models WHERE provider_id = ? ORDER BY model_id`, row.ID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()
		items := []aiModelOut{}
		for rows.Next() {
			var m aiModelOut
			if err := rows.Scan(&m.ID, &m.ModelID, &m.IsEnabled); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			items = append(items, m)
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items})
	})

	// Enable a model, or promote it to the provider's default (which also
	// enables it and clears the previous default).
	mux.HandleFunc("PATCH /api/ai/models/{id}", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			IsEnabled *bool `json:"is_enabled"`
			IsDefault *bool `json:"is_default"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		ctx := r.Context()
		userID := callerFrom(r).ID
		var providerID, modelID string
		err := db.QueryRowContext(ctx, `SELECT provider_id, model_id FROM ai_models WHERE id = ?`, r.PathValue("id")).
			Scan(&providerID, &modelID)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "model not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		provider, err := loadProvider(ctx, db, providerID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		allowed, err := canManage(ctx, db, provider, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if !allowed {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "you cannot manage this provider"})
			return
		}

		now := util.Now()
		if req.IsEnabled != nil {
			if _, err := db.ExecContext(ctx, `UPDATE ai_models SET is_enabled = ? WHERE id = ?`, *req.IsEnabled, r.PathValue("id")); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
		}
		if req.IsDefault != nil && *req.IsDefault {
			if _, err := db.ExecContext(ctx, `UPDATE ai_models SET is_enabled = 0, is_default = 0 WHERE provider_id = ?`, providerID); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			if _, err := db.ExecContext(ctx, `UPDATE ai_models SET is_enabled = 1, is_default = 1 WHERE id = ?`, r.PathValue("id")); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			if _, err := db.ExecContext(ctx, `UPDATE ai_providers SET default_model = ?, updated_at = ? WHERE id = ?`, modelID, now, providerID); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
}
