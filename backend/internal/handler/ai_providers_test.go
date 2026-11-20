package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"optimolms/backend/internal/db"
	"optimolms/backend/internal/keycrypt"
)

/*
The setup flow is verified end to end against a fake OpenAI-compatible
endpoint: the key is checked before it is stored, the starter set is switched on
without any clicking, and rotating to a key the endpoint refuses leaves the
working key in place.
*/

// aiProvidersAPI opens a seeded database with both provider registries wired.
func aiProvidersAPI(t *testing.T) (*sql.DB, *http.ServeMux, string) {
	t.Helper()
	ctx := context.Background()
	database, err := db.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })
	if err := db.Migrate(ctx, database); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	if err := db.Seed(ctx, database); err != nil {
		t.Fatalf("seed: %v", err)
	}
	var adminID string
	if err := database.QueryRowContext(ctx, `
		SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
		WHERE r.name = 'ADMIN' LIMIT 1`).Scan(&adminID); err != nil {
		t.Fatalf("admin: %v", err)
	}
	crypt, err := keycrypt.New("test-encryption-secret")
	if err != nil {
		t.Fatalf("crypt: %v", err)
	}
	mux := http.NewServeMux()
	registerAIProviders(mux, database, crypt)
	registerAIProviderSetup(mux, database, crypt)
	// The chat model list is where readiness is reported, so the test wires it.
	registerAIChat(mux, database, crypt)
	return database, mux, adminID
}

// providerStub is a fake model list: status 200 with the given ids, or a plain
// error status.
func providerStub(t *testing.T, status int, ids ...string) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if status != http.StatusOK {
			w.WriteHeader(status)
			_, _ = w.Write([]byte(`{"error":{"message":"nope"}}`))
			return
		}
		models := make([]map[string]string, 0, len(ids))
		for _, id := range ids {
			models = append(models, map[string]string{"id": id, "object": "model", "owned_by": "stub"})
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"object": "list", "data": models})
	}))
	t.Cleanup(server.Close)
	return server
}

func connectBody(baseURL, key string, extra map[string]any) map[string]any {
	body := map[string]any{
		"scope": "institutional", "name": "Stub AI",
		"base_url": baseURL, "api_key": key,
	}
	for k, v := range extra {
		body[k] = v
	}
	return body
}

func providerItems(t *testing.T, database *sql.DB, mux *http.ServeMux, adminID string) []aiProviderOut {
	t.Helper()
	recorder := callAs(t, database, mux, adminID, http.MethodGet, "/api/ai/providers?scope=institutional", nil)
	var list struct {
		Items []aiProviderOut `json:"items"`
	}
	decodeInto(t, recorder, http.StatusOK, &list)
	return list.Items
}

func TestConnectVerifiesKeyAndEnablesStarterSet(t *testing.T) {
	database, mux, adminID := aiProvidersAPI(t)
	stub := providerStub(t, http.StatusOK,
		"text-embedding-3-small", "gpt-4o-mini", "gpt-4o-2024-08-06", "gpt-4o", "whisper-1", "dall-e-3")

	recorder := callAs(t, database, mux, adminID, http.MethodPost, "/api/ai/providers/connect",
		connectBody(stub.URL, "sk-good-key-1234", nil))
	if recorder.Code != http.StatusCreated {
		t.Fatalf("connect status %d body %s", recorder.Code, recorder.Body.String())
	}

	items := providerItems(t, database, mux, adminID)
	if len(items) != 1 {
		t.Fatalf("want 1 provider, got %d", len(items))
	}
	provider := items[0]
	if provider.Health != healthOK {
		t.Errorf("health = %q, want %q", provider.Health, healthOK)
	}
	if !provider.IsEnabled {
		t.Error("a verified provider should be on: connecting is what turns the feature on")
	}
	if provider.ModelCount != 3 {
		t.Errorf("model_count = %d, want 3 chat models (embeddings, whisper and image are not chat)", provider.ModelCount)
	}
	if provider.EnabledModelCount != 2 {
		t.Errorf("enabled_model_count = %d, want 2 (one fast, one flagship)", provider.EnabledModelCount)
	}
	if provider.DefaultModel != "gpt-4o-mini" {
		t.Errorf("default_model = %q, want the fast starter model", provider.DefaultModel)
	}

	var cipher, hint string
	if err := database.QueryRow(`SELECT api_key_cipher, key_hint FROM ai_providers WHERE id = ?`, provider.ID).
		Scan(&cipher, &hint); err != nil {
		t.Fatal(err)
	}
	if cipher == "sk-good-key-1234" || cipher == "" {
		t.Error("the key must be stored encrypted")
	}
	if hint != "…1234" {
		t.Errorf("key_hint = %q, want the masked tail", hint)
	}
}

func TestConnectRefusesBadKeyAndStoresNothing(t *testing.T) {
	database, mux, adminID := aiProvidersAPI(t)
	stub := providerStub(t, http.StatusUnauthorized)

	recorder := callAs(t, database, mux, adminID, http.MethodPost, "/api/ai/providers/connect",
		connectBody(stub.URL, "sk-bad", nil))
	var problem map[string]any
	decodeInto(t, recorder, http.StatusUnprocessableEntity, &problem)
	if problem["code"] != healthInvalidKey {
		t.Errorf("code = %v, want %s", problem["code"], healthInvalidKey)
	}
	if items := providerItems(t, database, mux, adminID); len(items) != 0 {
		t.Errorf("a refused key must leave no provider behind, got %d", len(items))
	}
}

func TestConnectSaysWhyTheEndpointWasRefused(t *testing.T) {
	database, mux, adminID := aiProvidersAPI(t)
	missing := providerStub(t, http.StatusNotFound)

	recorder := callAs(t, database, mux, adminID, http.MethodPost, "/api/ai/providers/connect",
		connectBody(missing.URL, "sk-whatever", nil))
	var problem map[string]any
	decodeInto(t, recorder, http.StatusUnprocessableEntity, &problem)
	if problem["code"] != healthEndpointMissing {
		t.Errorf("code = %v, want %s (the message sends them to the /v1 suffix)", problem["code"], healthEndpointMissing)
	}
	if problem["error"] == "" {
		t.Error("the failure should carry a message the admin can read")
	}
}

func TestRotationKeepsTheWorkingKeyWhenTheNewOneFails(t *testing.T) {
	database, mux, adminID := aiProvidersAPI(t)
	good := providerStub(t, http.StatusOK, "gpt-4o-mini", "gpt-4o")
	bad := providerStub(t, http.StatusUnauthorized)

	if recorder := callAs(t, database, mux, adminID, http.MethodPost, "/api/ai/providers/connect",
		connectBody(good.URL, "sk-first-key", nil)); recorder.Code != http.StatusCreated {
		t.Fatalf("connect: %d %s", recorder.Code, recorder.Body.String())
	}
	provider := providerItems(t, database, mux, adminID)[0]

	var before string
	if err := database.QueryRow(`SELECT api_key_cipher FROM ai_providers WHERE id = ?`, provider.ID).Scan(&before); err != nil {
		t.Fatal(err)
	}

	// Point the provider at an endpoint that rejects the key, then rotate.
	if _, err := database.Exec(`UPDATE ai_providers SET base_url = ? WHERE id = ?`, bad.URL, provider.ID); err != nil {
		t.Fatal(err)
	}
	recorder := callAs(t, database, mux, adminID, http.MethodPut,
		"/api/ai/providers/"+provider.ID+"/key", map[string]any{"api_key": "sk-second-key"})
	var problem map[string]any
	decodeInto(t, recorder, http.StatusUnprocessableEntity, &problem)
	if problem["kept_existing"] != true {
		t.Error("the response should say the existing key is still in place")
	}

	var after string
	if err := database.QueryRow(`SELECT api_key_cipher FROM ai_providers WHERE id = ?`, provider.ID).Scan(&after); err != nil {
		t.Fatal(err)
	}
	if after != before {
		t.Error("a refused replacement must not overwrite the working key")
	}

	// A key the endpoint accepts replaces it.
	if _, err := database.Exec(`UPDATE ai_providers SET base_url = ? WHERE id = ?`, good.URL, provider.ID); err != nil {
		t.Fatal(err)
	}
	recorder = callAs(t, database, mux, adminID, http.MethodPut,
		"/api/ai/providers/"+provider.ID+"/key", map[string]any{"api_key": "sk-third-key"})
	decodeInto(t, recorder, http.StatusOK, nil)

	var rotated, hint string
	if err := database.QueryRow(`SELECT api_key_cipher, key_hint FROM ai_providers WHERE id = ?`, provider.ID).
		Scan(&rotated, &hint); err != nil {
		t.Fatal(err)
	}
	if rotated == before || hint != "…-key" {
		t.Errorf("the accepted key should replace the old one (hint %q)", hint)
	}
}

func TestTestConnectionRecordsHealthWithoutRepastingTheKey(t *testing.T) {
	database, mux, adminID := aiProvidersAPI(t)
	good := providerStub(t, http.StatusOK, "gpt-4o-mini")
	bad := providerStub(t, http.StatusUnauthorized)

	callAs(t, database, mux, adminID, http.MethodPost, "/api/ai/providers/connect",
		connectBody(good.URL, "sk-key", nil))
	provider := providerItems(t, database, mux, adminID)[0]

	recorder := callAs(t, database, mux, adminID, http.MethodPost, "/api/ai/providers/"+provider.ID+"/test", nil)
	var result map[string]any
	decodeInto(t, recorder, http.StatusOK, &result)
	if result["ok"] != true {
		t.Fatalf("health check on a working provider reported %v", result)
	}

	if _, err := database.Exec(`UPDATE ai_providers SET base_url = ? WHERE id = ?`, bad.URL, provider.ID); err != nil {
		t.Fatal(err)
	}
	recorder = callAs(t, database, mux, adminID, http.MethodPost, "/api/ai/providers/"+provider.ID+"/test", nil)
	decodeInto(t, recorder, http.StatusOK, &result)
	if result["ok"] != false || result["code"] != healthInvalidKey {
		t.Fatalf("want an invalid_key report, got %v", result)
	}

	// The list carries that outcome, so a broken provider is visible without
	// opening it.
	provider = providerItems(t, database, mux, adminID)[0]
	if provider.Health != healthInvalidKey || provider.HealthDetail == "" || provider.CheckedAt == "" {
		t.Errorf("list item should carry the failure: %+v", provider)
	}
}

func TestBulkModelActions(t *testing.T) {
	database, mux, adminID := aiProvidersAPI(t)
	stub := providerStub(t, http.StatusOK, "gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo")

	callAs(t, database, mux, adminID, http.MethodPost, "/api/ai/providers/connect",
		connectBody(stub.URL, "sk-key", nil))
	provider := providerItems(t, database, mux, adminID)[0]
	bulk := "/api/ai/providers/" + provider.ID + "/models/bulk"

	var summary providerModelSummary
	decodeInto(t, callAs(t, database, mux, adminID, http.MethodPost, bulk,
		map[string]any{"action": "enable_all"}), http.StatusOK, &summary)
	if summary.EnabledModelCount != 3 {
		t.Errorf("enable_all left %d enabled, want 3", summary.EnabledModelCount)
	}
	if summary.DefaultModel != "gpt-4o-mini" {
		t.Errorf("enable_all should not disturb the default, got %q", summary.DefaultModel)
	}

	decodeInto(t, callAs(t, database, mux, adminID, http.MethodPost, bulk,
		map[string]any{"action": "disable_all"}), http.StatusOK, &summary)
	if summary.EnabledModelCount != 0 {
		t.Errorf("disable_all left %d enabled", summary.EnabledModelCount)
	}
	if summary.DefaultModel != "" {
		t.Errorf("disabling everything must clear the default, got %q", summary.DefaultModel)
	}

	decodeInto(t, callAs(t, database, mux, adminID, http.MethodPost, bulk,
		map[string]any{"action": "enable_recommended"}), http.StatusOK, &summary)
	if summary.EnabledModelCount != 2 || summary.DefaultModel != "gpt-4o-mini" {
		t.Errorf("enable_recommended should restore the starter pair, got %+v", summary)
	}

	decodeInto(t, callAs(t, database, mux, adminID, http.MethodPost, bulk,
		map[string]any{"action": "disable", "model_ids": []string{"gpt-4o-mini"}}), http.StatusOK, &summary)
	if summary.DefaultModel == "gpt-4o-mini" {
		t.Error("a disabled model cannot stay the provider default")
	}
}

func TestPersonalConnectNeedsNoInstitutionalPermission(t *testing.T) {
	database, mux, _ := aiProvidersAPI(t)
	stub := providerStub(t, http.StatusOK, "gpt-4o-mini")

	var studentID string
	if err := database.QueryRow(`
		SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
		WHERE r.name = 'STUDENT' LIMIT 1`).Scan(&studentID); err != nil {
		t.Fatal(err)
	}

	recorder := callAs(t, database, mux, studentID, http.MethodPost, "/api/ai/providers/connect",
		connectBody(stub.URL, "sk-own", map[string]any{"scope": "personal", "name": "Mine"}))
	if recorder.Code != http.StatusCreated {
		t.Fatalf("personal connect: %d %s", recorder.Code, recorder.Body.String())
	}

	// One personal provider per person.
	recorder = callAs(t, database, mux, studentID, http.MethodPost, "/api/ai/providers/connect",
		connectBody(stub.URL, "sk-own-2", map[string]any{"scope": "personal", "name": "Mine again"}))
	if recorder.Code != http.StatusConflict {
		t.Errorf("second personal provider: %d, want 409", recorder.Code)
	}

	// Institutional stays behind assistant.configure.
	recorder = callAs(t, database, mux, studentID, http.MethodPost, "/api/ai/providers/connect",
		connectBody(stub.URL, "sk-school", nil))
	if recorder.Code != http.StatusForbidden {
		t.Errorf("student adding an institutional provider: %d, want 403", recorder.Code)
	}
}

// TestChatModelsReportReadiness pins the signal the UI hides the assistant on:
// a chat that cannot answer is never offered.
func TestChatModelsReportReadiness(t *testing.T) {
	database, mux, adminID := aiProvidersAPI(t)

	readiness := func() (bool, string) {
		t.Helper()
		recorder := callAs(t, database, mux, adminID, http.MethodGet, "/api/ai/chat-models", nil)
		var out struct {
			Ready  bool   `json:"ready"`
			Reason string `json:"reason"`
		}
		decodeInto(t, recorder, http.StatusOK, &out)
		return out.Ready, out.Reason
	}

	if ready, reason := readiness(); ready || reason != reasonNoProvider {
		t.Fatalf("nothing configured: ready=%v reason=%q, want false/%s", ready, reason, reasonNoProvider)
	}

	stub := providerStub(t, http.StatusOK, "gpt-4o-mini", "gpt-4o")
	if recorder := callAs(t, database, mux, adminID, http.MethodPost, "/api/ai/providers/connect",
		connectBody(stub.URL, "sk-key", nil)); recorder.Code != http.StatusCreated {
		t.Fatalf("connect: %d %s", recorder.Code, recorder.Body.String())
	}
	if ready, reason := readiness(); !ready || reason != "" {
		t.Fatalf("after connect: ready=%v reason=%q, want true/\"\"", ready, reason)
	}

	provider := providerItems(t, database, mux, adminID)[0]
	callAs(t, database, mux, adminID, http.MethodPost,
		"/api/ai/providers/"+provider.ID+"/models/bulk", map[string]any{"action": "disable_all"})
	if ready, reason := readiness(); ready || reason != reasonNoModel {
		t.Fatalf("no model on: ready=%v reason=%q, want false/%s", ready, reason, reasonNoModel)
	}

	callAs(t, database, mux, adminID, http.MethodPatch,
		"/api/ai/providers/"+provider.ID, map[string]any{"is_enabled": false})
	if ready, reason := readiness(); ready || reason != reasonInactiveProvider {
		t.Fatalf("provider off: ready=%v reason=%q, want false/%s", ready, reason, reasonInactiveProvider)
	}
}
