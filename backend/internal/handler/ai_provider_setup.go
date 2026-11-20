package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"

	"github.com/openai/openai-go"

	"optimolms/backend/internal/ai"
	"optimolms/backend/internal/keycrypt"
	"optimolms/backend/internal/util"
)

/*
Connecting a provider is one request: verify the key against the endpoint, pull
its model catalogue, store the key encrypted and switch on a starter set of
models. The key is written only after the endpoint has accepted it, so a typo in
a replacement key never takes a working provider offline.

The stored health columns (health, health_detail, checked_at) are what the
Providers tab shows as a status pill, so "is this provider broken?" is answered
by the list itself instead of by clicking into every provider.
*/

// Verification outcomes stored in ai_providers.health. "" means never checked.
const (
	healthOK              = "ok"
	healthNoModels        = "no_models"
	healthInvalidKey      = "invalid_key"
	healthUnreachable     = "unreachable"
	healthTimeout         = "timeout"
	healthEndpointMissing = "endpoint_missing"
	healthRateLimited     = "rate_limited"
)

// keyProblem says why an endpoint or key was refused, in a form the UI can show
// under the input it belongs to.
type keyProblem struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// classifyKeyError turns a provider failure into a cause the admin can act on:
// a bad key, a wrong base URL, an unreachable host, or a slow one.
func classifyKeyError(err error) keyProblem {
	var apiErr *openai.Error
	if errors.As(err, &apiErr) {
		status := apiErr.StatusCode
		switch {
		case status == http.StatusUnauthorized || status == http.StatusForbidden:
			return keyProblem{healthInvalidKey, "The endpoint rejected this key (HTTP " + itoa(status) + "). Copy it again from the provider's dashboard."}
		case status == http.StatusNotFound || status == http.StatusMethodNotAllowed:
			return keyProblem{healthEndpointMissing, "No model list at this base URL (HTTP " + itoa(status) + "). It usually ends in /v1."}
		case status == http.StatusTooManyRequests:
			return keyProblem{healthRateLimited, "The endpoint is rate-limiting this key (HTTP 429). Try again in a minute."}
		case status == http.StatusBadRequest || status == http.StatusUnprocessableEntity:
			return keyProblem{healthInvalidKey, "The endpoint refused the key (HTTP " + itoa(status) + "): " + apiErr.Message}
		case status >= 500:
			return keyProblem{healthUnreachable, "The endpoint failed its own request (HTTP " + itoa(status) + "). Try again shortly."}
		default:
			return keyProblem{healthUnreachable, "The endpoint answered HTTP " + itoa(status) + ": " + apiErr.Message}
		}
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return keyProblem{healthTimeout, "The endpoint did not answer in time. Check the base URL and the network path to it."}
	}
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return keyProblem{healthTimeout, "The endpoint did not answer in time. Check the base URL and the network path to it."}
	}
	var dnsErr *net.DNSError
	if errors.As(err, &dnsErr) {
		return keyProblem{healthUnreachable, "The host in the base URL could not be resolved. Check the spelling."}
	}
	var urlErr *url.Error
	if errors.As(err, &urlErr) {
		return keyProblem{healthUnreachable, "Could not reach the endpoint: " + urlErr.Err.Error()}
	}
	return keyProblem{healthUnreachable, "Could not reach the endpoint: " + err.Error()}
}

func itoa(value int) string { return fmt.Sprintf("%d", value) }

// checkEndpoint asks a provider's model list what its key may use. A key that
// is accepted but lists nothing is a problem too: a provider with no model
// cannot serve a chat.
func checkEndpoint(ctx context.Context, baseURL, apiKey string) (keyProblem, []string) {
	models, err := ai.ListModels(ctx, baseURL, apiKey)
	if err != nil {
		return classifyKeyError(err), nil
	}
	chat := ai.ChatModels(models)
	if len(chat) == 0 {
		return keyProblem{healthNoModels, "The endpoint answered but listed no chat models. Check that the base URL is the API root."}, nil
	}
	return keyProblem{Code: healthOK}, chat
}

// syncCatalogue stores the discovered models, switches on the ones worth
// starting with and pins the default. Existing rows keep their enabled state:
// discovery adds models, it never silently turns off an admin's choice.
func syncCatalogue(ctx context.Context, db *sql.DB, providerID string, models, enable []string, defaultModel string) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	for _, modelID := range models {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO ai_models (id, provider_id, model_id, is_enabled) VALUES (?, ?, ?, 0)
			ON CONFLICT(provider_id, model_id) DO NOTHING`,
			util.NewID(), providerID, modelID); err != nil {
			return err
		}
	}
	for _, modelID := range enable {
		if _, err := tx.ExecContext(ctx, `UPDATE ai_models SET is_enabled = 1 WHERE provider_id = ? AND model_id = ?`,
			providerID, modelID); err != nil {
			return err
		}
	}
	if defaultModel != "" {
		if _, err := tx.ExecContext(ctx, `UPDATE ai_models SET is_default = 0 WHERE provider_id = ?`, providerID); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `UPDATE ai_models SET is_enabled = 1, is_default = 1 WHERE provider_id = ? AND model_id = ?`,
			providerID, defaultModel); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `UPDATE ai_providers SET default_model = ?, updated_at = ? WHERE id = ?`,
			defaultModel, util.Now(), providerID); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// starterPlan decides what a newly verified provider should switch on: the
// recommended pair when the admin has not chosen anything yet, and nothing at
// all once a default or any enabled model exists.
func starterPlan(ctx context.Context, db *sql.DB, providerID, currentDefault string, models []string) (enable []string, defaultModel string) {
	if currentDefault != "" {
		return nil, ""
	}
	var enabled int
	if err := db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM ai_models WHERE provider_id = ? AND is_enabled = 1`, providerID).Scan(&enabled); err != nil {
		return nil, ""
	}
	if enabled > 0 {
		return nil, ""
	}
	return ai.Starter(models)
}

// recordHealth stores the outcome of one check so the list can show it later.
func recordHealth(ctx context.Context, db *sql.DB, providerID string, problem keyProblem) error {
	detail := ""
	if problem.Code != healthOK {
		detail = problem.Message
	}
	_, err := db.ExecContext(ctx, `
		UPDATE ai_providers SET health = ?, health_detail = ?, checked_at = ?, updated_at = ?
		WHERE id = ?`, problem.Code, detail, util.Now(), util.Now(), providerID)
	return err
}

// providerSelect is the one shape every provider response is built from: the
// row, its stored health, and how many of its models are on.
const providerSelect = `
	SELECT p.id, p.scope, p.name, p.base_url, p.api_key_cipher IS NOT NULL, p.key_hint,
	       p.is_enabled, p.default_model, p.health, p.health_detail, p.checked_at,
	       (SELECT COUNT(*) FROM ai_models m WHERE m.provider_id = p.id),
	       (SELECT COUNT(*) FROM ai_models m WHERE m.provider_id = p.id AND m.is_enabled = 1)`

type rowScanner interface {
	Scan(dest ...any) error
}

func scanProviderOut(row rowScanner) (aiProviderOut, error) {
	var out aiProviderOut
	err := row.Scan(&out.ID, &out.Scope, &out.Name, &out.BaseURL, &out.HasKey, &out.KeyHint,
		&out.IsEnabled, &out.DefaultModel, &out.Health, &out.HealthDetail, &out.CheckedAt,
		&out.ModelCount, &out.EnabledModelCount)
	return out, err
}

func loadProviderOut(ctx context.Context, db *sql.DB, id string) (aiProviderOut, error) {
	return scanProviderOut(db.QueryRowContext(ctx, providerSelect+` FROM ai_providers p WHERE p.id = ?`, id))
}

// providerModelSummary is the small answer every model change returns, so a
// card can update its pill without re-reading the whole provider.
type providerModelSummary struct {
	ModelCount        int    `json:"model_count"`
	EnabledModelCount int    `json:"enabled_model_count"`
	DefaultModel      string `json:"default_model"`
}

func modelSummary(ctx context.Context, db *sql.DB, providerID string) (providerModelSummary, error) {
	var out providerModelSummary
	err := db.QueryRowContext(ctx, `
		SELECT (SELECT COUNT(*) FROM ai_models WHERE provider_id = ?),
		       (SELECT COUNT(*) FROM ai_models WHERE provider_id = ? AND is_enabled = 1),
		       (SELECT default_model FROM ai_providers WHERE id = ?)`,
		providerID, providerID, providerID).Scan(&out.ModelCount, &out.EnabledModelCount, &out.DefaultModel)
	return out, err
}

// ensureCanAddProvider enforces "one personal provider per person" and the
// assistant.configure permission for institutional ones.
func ensureCanAddProvider(ctx context.Context, db *sql.DB, userID, scope string) (int, string) {
	switch scope {
	case "personal":
		var count int
		if err := db.QueryRowContext(ctx,
			`SELECT COUNT(*) FROM ai_providers WHERE scope = 'personal' AND owner_user_id = ?`, userID).Scan(&count); err != nil {
			return http.StatusInternalServerError, err.Error()
		}
		if count >= 1 {
			return http.StatusConflict, "You already have a personal provider. Edit or delete it first."
		}
	case "institutional":
		return configureDenied(ctx, db, userID)
	default:
		return http.StatusBadRequest, "scope must be institutional or personal"
	}
	return 0, ""
}

// manageDenied returns the status and message when userID may not touch this
// provider, or 0 when it may.
func manageDenied(ctx context.Context, db *sql.DB, providerID, userID string) (providerRow, int, string) {
	row, err := loadProvider(ctx, db, providerID)
	if err == sql.ErrNoRows {
		return row, http.StatusNotFound, "provider not found"
	}
	if err != nil {
		return row, http.StatusInternalServerError, err.Error()
	}
	allowed, err := canManage(ctx, db, row, userID)
	if err != nil {
		return row, http.StatusInternalServerError, err.Error()
	}
	if !allowed {
		return row, http.StatusForbidden, "you cannot manage this provider"
	}
	return row, 0, ""
}

func registerAIProviderSetup(mux *http.ServeMux, db *sql.DB, crypt *keycrypt.Crypt) {
	// POST /api/ai/providers/connect — the whole setup on one screen: create
	// the provider, verify the key, discover its models and switch on a starter
	// set. Nothing is stored unless the endpoint accepts the key, unless the
	// admin explicitly saves an unverified key (a gateway without /models).
	mux.HandleFunc("POST /api/ai/providers/connect", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Scope           string `json:"scope"`
			Name            string `json:"name"`
			BaseURL         string `json:"base_url"`
			APIKey          string `json:"api_key"`
			Preset          string `json:"preset"`
			AllowUnverified bool   `json:"allow_unverified"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		ctx := r.Context()
		userID := callerFrom(r).ID

		req.Scope = strings.TrimSpace(req.Scope)
		if req.Scope == "" {
			req.Scope = "personal"
		}
		req.Name = strings.TrimSpace(req.Name)
		req.BaseURL = strings.TrimRight(strings.TrimSpace(req.BaseURL), "/")
		req.APIKey = strings.TrimSpace(req.APIKey)

		parsed, err := url.Parse(req.BaseURL)
		if err != nil || len(req.BaseURL) > maxBaseURL ||
			(parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "base_url must be a valid http(s) endpoint"})
			return
		}
		if req.Name == "" {
			// A name is a label, not a decision: fall back to the host.
			req.Name = parsed.Host
		}
		if len(req.Name) > maxProviderName {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "A provider name of up to 80 characters is required"})
			return
		}
		if len(req.APIKey) > maxAPIKeyLength {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "An API key of up to 400 characters is allowed"})
			return
		}
		if status, message := ensureCanAddProvider(ctx, db, userID, req.Scope); status != 0 {
			writeJSON(w, status, map[string]string{"error": message})
			return
		}

		// Verify before writing anything: a refused key leaves no rows behind.
		problem, models := checkEndpoint(ctx, req.BaseURL, req.APIKey)
		if problem.Code != healthOK && !req.AllowUnverified {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]any{
				"error": problem.Message, "code": problem.Code,
			})
			return
		}

		id, now := util.NewID(), util.Now()
		var owner any
		if req.Scope == "personal" {
			owner = userID
		}
		var cipher any
		hint := ""
		if req.APIKey != "" {
			sealed, err := crypt.Encrypt(req.APIKey)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			cipher, hint = sealed, keycrypt.Hint(req.APIKey)
		}
		detail := ""
		if problem.Code != healthOK {
			detail = problem.Message
		}
		// A verified provider is switched on: connecting it is what turns the
		// feature on, so there is no second toggle to remember.
		if _, err := db.ExecContext(ctx, `
			INSERT INTO ai_providers
				(id, scope, owner_user_id, name, base_url, api_key_cipher, key_hint,
				 is_enabled, health, health_detail, checked_at, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			id, req.Scope, owner, req.Name, req.BaseURL, cipher, hint,
			problem.Code == healthOK, problem.Code, detail, now, now, now); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		enable, defaultModel := ai.Starter(models)
		if err := syncCatalogue(ctx, db, id, models, enable, defaultModel); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		out, err := loadProviderOut(ctx, db, id)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{
			"provider": out, "provider_id": id, "code": problem.Code,
			"enabled_models": enable, "default_model": defaultModel,
		})
	})

	// PUT /api/ai/providers/{id}/key — rotate (or set) the key. The new key is
	// verified first; a failure returns 422 and leaves the stored key, hint and
	// health untouched.
	mux.HandleFunc("PUT /api/ai/providers/{id}/key", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			APIKey          string `json:"api_key"`
			AllowUnverified bool   `json:"allow_unverified"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		ctx := r.Context()
		userID := callerFrom(r).ID
		req.APIKey = strings.TrimSpace(req.APIKey)
		if req.APIKey == "" || len(req.APIKey) > maxAPIKeyLength {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "An API key of up to 400 characters is required"})
			return
		}

		row, status, message := manageDenied(ctx, db, r.PathValue("id"), userID)
		if status != 0 {
			writeJSON(w, status, map[string]string{"error": message})
			return
		}

		problem, models := checkEndpoint(ctx, row.BaseURL, req.APIKey)
		if problem.Code != healthOK && !req.AllowUnverified {
			// Deliberately no write: the old key keeps working.
			writeJSON(w, http.StatusUnprocessableEntity, map[string]any{
				"error": problem.Message, "code": problem.Code, "kept_existing": row.APIKeyCipher.Valid,
			})
			return
		}

		cipher, err := crypt.Encrypt(req.APIKey)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		detail := ""
		if problem.Code != healthOK {
			detail = problem.Message
		}
		// Cipher, hint and health move in one statement: the stored key is
		// never half-replaced.
		if _, err := db.ExecContext(ctx, `
			UPDATE ai_providers
			SET api_key_cipher = ?, key_hint = ?, health = ?, health_detail = ?, checked_at = ?, updated_at = ?
			WHERE id = ?`,
			cipher, keycrypt.Hint(req.APIKey), problem.Code, detail, util.Now(), util.Now(), row.ID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		out := map[string]any{
			"status": "ok", "key_hint": keycrypt.Hint(req.APIKey), "code": problem.Code,
			"model_count": 0, "enabled_models": []string{},
		}
		if problem.Code == healthOK {
			enable, defaultModel := starterPlan(ctx, db, row.ID, row.DefaultModel, models)
			if err := syncCatalogue(ctx, db, row.ID, models, enable, defaultModel); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			out["model_count"] = len(models)
			out["enabled_models"] = enable
			out["default_model"] = defaultModel
		}
		summary, err := modelSummary(ctx, db, row.ID)
		if err == nil {
			out["model_count"] = summary.ModelCount
			out["enabled_model_count"] = summary.EnabledModelCount
			out["default_model"] = summary.DefaultModel
		}
		writeJSON(w, http.StatusOK, out)
	})

	// POST /api/ai/providers/{id}/test — check the stored key against the
	// endpoint without re-pasting it, and record what was found.
	mux.HandleFunc("POST /api/ai/providers/{id}/test", func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		userID := callerFrom(r).ID
		row, status, message := manageDenied(ctx, db, r.PathValue("id"), userID)
		if status != 0 {
			writeJSON(w, status, map[string]string{"error": message})
			return
		}

		apiKey, err := crypt.Decrypt(row.APIKeyCipher.String)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "The stored key could not be decrypted. Save it again."})
			return
		}

		problem, models := checkEndpoint(ctx, row.BaseURL, apiKey)
		if err := recordHealth(ctx, db, row.ID, problem); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if problem.Code == healthOK {
			// Refresh the catalogue too: a provider may have gained models since
			// it was connected. Nothing is enabled unless nothing was before.
			enable, defaultModel := starterPlan(ctx, db, row.ID, row.DefaultModel, models)
			if err := syncCatalogue(ctx, db, row.ID, models, enable, defaultModel); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
		}
		summary, err := modelSummary(ctx, db, row.ID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"ok": problem.Code == healthOK, "code": problem.Code, "message": problem.Message,
			"model_count": summary.ModelCount, "enabled_model_count": summary.EnabledModelCount,
			"default_model": summary.DefaultModel, "checked_at": util.Now(),
		})
	})

	// POST /api/ai/providers/{id}/models/bulk — one request for a whole
	// catalogue instead of a PATCH per model.
	mux.HandleFunc("POST /api/ai/providers/{id}/models/bulk", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Action   string   `json:"action"`
			ModelIDs []string `json:"model_ids"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		ctx := r.Context()
		userID := callerFrom(r).ID
		row, status, message := manageDenied(ctx, db, r.PathValue("id"), userID)
		if status != 0 {
			writeJSON(w, status, map[string]string{"error": message})
			return
		}

		tx, err := db.BeginTx(ctx, nil)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer func() { _ = tx.Rollback() }()

		switch req.Action {
		case "enable_all":
			_, err = tx.ExecContext(ctx, `UPDATE ai_models SET is_enabled = 1 WHERE provider_id = ?`, row.ID)
		case "disable_all":
			if _, err = tx.ExecContext(ctx, `UPDATE ai_models SET is_enabled = 0, is_default = 0 WHERE provider_id = ?`, row.ID); err == nil {
				_, err = tx.ExecContext(ctx, `UPDATE ai_providers SET default_model = '', updated_at = ? WHERE id = ?`, util.Now(), row.ID)
			}
		case "enable_recommended":
			var ids []string
			ids, err = storedModelIDs(ctx, tx, row.ID)
			if err == nil {
				enable, defaultModel := ai.Starter(ids)
				for _, modelID := range enable {
					if _, err = tx.ExecContext(ctx, `UPDATE ai_models SET is_enabled = 1 WHERE provider_id = ? AND model_id = ?`,
						row.ID, modelID); err != nil {
						break
					}
				}
				if err == nil && row.DefaultModel == "" && defaultModel != "" {
					err = pinDefault(ctx, tx, row.ID, defaultModel)
				}
			}
		case "enable", "disable":
			if len(req.ModelIDs) == 0 {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "model_ids is required for this action"})
				return
			}
			enable := req.Action == "enable"
			for _, modelID := range req.ModelIDs {
				if _, err = tx.ExecContext(ctx, `UPDATE ai_models SET is_enabled = ? WHERE provider_id = ? AND model_id = ?`,
					enable, row.ID, modelID); err != nil {
					break
				}
				// A disabled default would leave chat pointing at a model the
				// admin just switched off.
				if !enable && row.DefaultModel == modelID {
					if _, err = tx.ExecContext(ctx, `UPDATE ai_models SET is_default = 0 WHERE provider_id = ? AND model_id = ?`,
						row.ID, modelID); err == nil {
						_, err = tx.ExecContext(ctx, `UPDATE ai_providers SET default_model = '', updated_at = ? WHERE id = ?`,
							util.Now(), row.ID)
					}
				}
			}
			if err == nil && enable && row.DefaultModel == "" {
				err = pinDefault(ctx, tx, row.ID, req.ModelIDs[0])
			}
		default:
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": "action must be enable, disable, enable_all, disable_all or enable_recommended",
			})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		summary, err := modelSummary(ctx, db, row.ID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, summary)
	})
}

// storedModelIDs is the provider's catalogue as stored, used when recommending
// from the rows rather than from a fresh /models call.
func storedModelIDs(ctx context.Context, tx *sql.Tx, providerID string) ([]string, error) {
	rows, err := tx.QueryContext(ctx, `SELECT model_id FROM ai_models WHERE provider_id = ? ORDER BY model_id`, providerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ids := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// pinDefault makes one model the provider's default and enables it.
func pinDefault(ctx context.Context, tx *sql.Tx, providerID, modelID string) error {
	if _, err := tx.ExecContext(ctx, `UPDATE ai_models SET is_default = 0 WHERE provider_id = ?`, providerID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE ai_models SET is_enabled = 1, is_default = 1 WHERE provider_id = ? AND model_id = ?`,
		providerID, modelID); err != nil {
		return err
	}
	_, err := tx.ExecContext(ctx, `UPDATE ai_providers SET default_model = ?, updated_at = ? WHERE id = ?`,
		modelID, util.Now(), providerID)
	return err
}
