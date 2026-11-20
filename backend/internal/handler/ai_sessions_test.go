package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"optimolms/backend/internal/db"
	"optimolms/backend/internal/util"
)

func aiSessionsAPI(t *testing.T) (*sql.DB, *http.ServeMux, string, string) {
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
	roleID, now := util.NewID(), util.Now()
	if _, err := database.ExecContext(ctx, `INSERT INTO roles (id, name) VALUES (?, 'STUDENT')`, roleID); err != nil {
		t.Fatalf("insert role: %v", err)
	}
	users := []string{util.NewID(), util.NewID()}
	for i, id := range users {
		if _, err := database.ExecContext(ctx, `
			INSERT INTO users (id, email, password_hash, name, role_id, created_at, updated_at)
			VALUES (?, ?, 'x', ?, ?, ?, ?)`, id, fmt.Sprintf("u%d@school.edu", i), "User", roleID, now, now); err != nil {
			t.Fatalf("insert user: %v", err)
		}
	}
	mux := http.NewServeMux()
	registerAISessions(mux, database)
	return database, mux, users[0], users[1]
}

func decodeInto(t *testing.T, recorder *httptest.ResponseRecorder, want int, out any) {
	t.Helper()
	if recorder.Code != want {
		t.Fatalf("status %d (want %d) body %s", recorder.Code, want, recorder.Body.String())
	}
	if out != nil {
		if err := json.NewDecoder(recorder.Body).Decode(out); err != nil {
			t.Fatalf("decode: %v", err)
		}
	}
}

func userMessage(text string) map[string]any {
	return map[string]any{"id": util.NewID(), "role": "user", "parts": []map[string]any{
		{"type": "step-start"}, {"type": "text", "text": text},
	}}
}

func TestAISessionsLifecycle(t *testing.T) {
	database, mux, owner, other := aiSessionsAPI(t)

	var created aiSessionOut
	decodeInto(t, callAs(t, database, mux, owner, http.MethodPost, "/api/ai/sessions", nil), http.StatusCreated, &created)
	if created.ID == "" || created.MessageCount != 0 || created.Title != "" {
		t.Fatalf("unexpected created session %+v", created)
	}

	// Empty sessions stay out of the list.
	var list aiSessionListOut
	decodeInto(t, callAs(t, database, mux, owner, http.MethodGet, "/api/ai/sessions", nil), http.StatusOK, &list)
	if len(list.Items) != 0 || list.NextPage != nil {
		t.Fatalf("empty session listed: %+v", list)
	}

	messages := []any{
		userMessage("  Explain   photosynthesis\n to me "),
		map[string]any{"id": "a1", "role": "assistant", "parts": []map[string]any{{"type": "text", "text": "Sure"}}},
	}
	var saved aiSessionOut
	path := "/api/ai/sessions/" + created.ID + "/messages"
	decodeInto(t, callAs(t, database, mux, owner, http.MethodPut, path, map[string]any{"messages": messages}), http.StatusOK, &saved)
	if saved.Title != "Explain photosynthesis to me" || saved.MessageCount != 2 {
		t.Fatalf("unexpected saved summary %+v", saved)
	}

	// The title is kept once set.
	messages = append([]any{userMessage("Something else")}, messages...)
	decodeInto(t, callAs(t, database, mux, owner, http.MethodPut, path, map[string]any{"messages": messages}), http.StatusOK, &saved)
	if saved.Title != "Explain photosynthesis to me" || saved.MessageCount != 3 {
		t.Fatalf("title changed or count wrong: %+v", saved)
	}

	// Not an array → 400; another user → 404.
	decodeInto(t, callAs(t, database, mux, owner, http.MethodPut, path, map[string]any{"messages": map[string]any{}}), http.StatusBadRequest, nil)
	decodeInto(t, callAs(t, database, mux, other, http.MethodPut, path, map[string]any{"messages": []any{}}), http.StatusNotFound, nil)

	var detail aiSessionDetailOut
	decodeInto(t, callAs(t, database, mux, owner, http.MethodGet, "/api/ai/sessions/"+created.ID, nil), http.StatusOK, &detail)
	var stored []map[string]any
	if err := json.Unmarshal(detail.Messages, &stored); err != nil || len(stored) != 3 || stored[1]["role"] != "user" {
		t.Fatalf("stored messages not verbatim: %s (%v)", detail.Messages, err)
	}
	decodeInto(t, callAs(t, database, mux, other, http.MethodGet, "/api/ai/sessions/"+created.ID, nil), http.StatusNotFound, nil)

	// Paging: three non-empty sessions, two per page, newest first.
	for i := 0; i < 2; i++ {
		var s aiSessionOut
		decodeInto(t, callAs(t, database, mux, owner, http.MethodPost, "/api/ai/sessions", nil), http.StatusCreated, &s)
		decodeInto(t, callAs(t, database, mux, owner, http.MethodPut, "/api/ai/sessions/"+s.ID+"/messages",
			map[string]any{"messages": []any{userMessage(fmt.Sprintf("chat %d", i))}}), http.StatusOK, nil)
		if _, err := database.Exec(`UPDATE ai_chat_sessions SET updated_at = ? WHERE id = ?`,
			fmt.Sprintf("2999-01-0%dT00:00:00Z", i+1), s.ID); err != nil {
			t.Fatal(err)
		}
	}
	decodeInto(t, callAs(t, database, mux, owner, http.MethodGet, "/api/ai/sessions?limit=2", nil), http.StatusOK, &list)
	if len(list.Items) != 2 || list.NextPage == nil || *list.NextPage != 2 || list.Items[0].Title != "chat 1" {
		t.Fatalf("unexpected page 1: %+v", list)
	}
	list = aiSessionListOut{}
	decodeInto(t, callAs(t, database, mux, owner, http.MethodGet, "/api/ai/sessions?limit=2&page=2", nil), http.StatusOK, &list)
	if len(list.Items) != 1 || list.NextPage != nil || list.Items[0].ID != created.ID {
		t.Fatalf("unexpected page 2: %+v", list)
	}
	decodeInto(t, callAs(t, database, mux, other, http.MethodGet, "/api/ai/sessions", nil), http.StatusOK, &list)
	if len(list.Items) != 0 {
		t.Fatalf("other user sees sessions: %+v", list)
	}

	decodeInto(t, callAs(t, database, mux, other, http.MethodDelete, "/api/ai/sessions/"+created.ID, nil), http.StatusNotFound, nil)
	decodeInto(t, callAs(t, database, mux, owner, http.MethodDelete, "/api/ai/sessions/"+created.ID, nil), http.StatusNoContent, nil)
	decodeInto(t, callAs(t, database, mux, owner, http.MethodGet, "/api/ai/sessions/"+created.ID, nil), http.StatusNotFound, nil)
}

func TestDeriveSessionTitle(t *testing.T) {
	text := func(role string, texts ...string) aiUIMessage {
		m := aiUIMessage{Role: role}
		for _, s := range texts {
			m.Parts = append(m.Parts, aiUIPart{Type: "text", Text: s})
		}
		return m
	}
	long := strings.Repeat("é", 70)
	cases := []struct {
		name     string
		messages []aiUIMessage
		want     string
	}{
		{"none", nil, ""},
		{"skips assistant and empty user", []aiUIMessage{text("assistant", "hi"), text("user", "   "), text("user", "a\n\tb", "c")}, "a b c"},
		{"ignores non-text parts", []aiUIMessage{{Role: "user", Parts: []aiUIPart{{Type: "file", Text: "x"}, {Type: "text", Text: "hello"}}}}, "hello"},
		{"exactly 60 runes", []aiUIMessage{text("user", long[:120])}, strings.Repeat("é", 60)},
		{"cut with ellipsis", []aiUIMessage{text("user", long)}, strings.Repeat("é", 60) + "…"},
	}
	for _, c := range cases {
		if got := deriveSessionTitle(c.messages); got != c.want {
			t.Errorf("%s: got %q want %q", c.name, got, c.want)
		}
	}
}
