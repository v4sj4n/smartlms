package handler

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"optimolms/backend/internal/config"
	"optimolms/backend/internal/db"
	"optimolms/backend/internal/keycrypt"
	"optimolms/backend/internal/totp"
	"optimolms/backend/internal/util"
)

// authAPI is the whole server — every route behind the session middleware — over
// a throwaway seeded database, so the tests exercise the real policy, the real
// SQL and the real cookie handling.
type authAPI struct {
	t     *testing.T
	app   http.Handler
	db    *sql.DB
	users map[string]string // role name -> user id
	cfg   config.Config
}

func newAuthAPI(t *testing.T) *authAPI {
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

	users := map[string]string{}
	rows, err := database.QueryContext(ctx,
		`SELECT u.id, r.name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.email LIKE '%@optimolms.dev'`)
	if err != nil {
		t.Fatalf("users: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		var id, role string
		if err := rows.Scan(&id, &role); err != nil {
			t.Fatal(err)
		}
		users[role] = id
	}

	cfg := config.Config{EncryptionSecret: "test-encryption-secret"}
	mux := http.NewServeMux()
	return &authAPI{t: t, app: Register(mux, database, cfg), db: database, users: users, cfg: cfg}
}

// credentials are the seeded demo passwords.
var credentials = map[string]string{
	"ADMIN":    "admin123",
	"LECTURER": "lecturer123",
	"STUDENT":  "student123",
}

func (api *authAPI) emails() map[string]string {
	return map[string]string{
		"ADMIN":    "admin@optimolms.dev",
		"LECTURER": "lecturer@optimolms.dev",
		"STUDENT":  "student@optimolms.dev",
	}
}

func (api *authAPI) post(method, path string, body any, cookie *http.Cookie) *httptest.ResponseRecorder {
	api.t.Helper()
	var reader *bytes.Reader
	if body == nil {
		reader = bytes.NewReader(nil)
	} else {
		payload, err := json.Marshal(body)
		if err != nil {
			api.t.Fatalf("marshal body: %v", err)
		}
		reader = bytes.NewReader(payload)
	}
	request := httptest.NewRequest(method, path, reader)
	request.Header.Set("Content-Type", "application/json")
	if cookie != nil {
		request.AddCookie(cookie)
	}
	recorder := httptest.NewRecorder()
	api.app.ServeHTTP(recorder, request)
	return recorder
}

// signIn posts the password and returns the session cookie the browser would
// keep.
func (api *authAPI) signIn(role string) (*http.Cookie, loginResponse) {
	api.t.Helper()
	recorder := api.post(http.MethodPost, "/api/auth/login", map[string]string{
		"email": api.emails()[role], "password": credentials[role],
	}, nil)
	if recorder.Code != http.StatusOK {
		api.t.Fatalf("login %s: status %d body %s", role, recorder.Code, recorder.Body.String())
	}
	cookie := sessionCookie(api.t, recorder)
	var payload loginResponse
	if err := json.NewDecoder(recorder.Body).Decode(&payload); err != nil {
		api.t.Fatalf("decode login: %v", err)
	}
	return cookie, payload
}

// asRole signs in and performs one request with that session.
func (api *authAPI) asRole(role, method, path string, body any) *httptest.ResponseRecorder {
	api.t.Helper()
	cookie, _ := api.signIn(role)
	return api.post(method, path, body, cookie)
}

func sessionCookie(t *testing.T, recorder *httptest.ResponseRecorder) *http.Cookie {
	t.Helper()
	for _, cookie := range recorder.Result().Cookies() {
		if cookie.Name == sessionCookieName {
			if cookie.Value == "" {
				t.Fatalf("session cookie was cleared, not set")
			}
			return cookie
		}
	}
	t.Fatalf("no %s cookie in the response: %v", sessionCookieName, recorder.Result().Header)
	return nil
}

/* --- signing in, out and expiring ----------------------------------------- */

func TestLoginIssuesASessionAndMeResolvesIt(t *testing.T) {
	api := newAuthAPI(t)

	recorder := api.post(http.MethodPost, "/api/auth/login", map[string]string{
		"email": "lecturer@optimolms.dev", "password": "lecturer123",
	}, nil)
	if recorder.Code != http.StatusOK {
		t.Fatalf("login: status %d body %s", recorder.Code, recorder.Body.String())
	}

	cookie := sessionCookie(t, recorder)
	if !cookie.HttpOnly {
		t.Error("the session cookie must be HttpOnly")
	}
	if cookie.SameSite != http.SameSiteLaxMode {
		t.Errorf("same-site policy = %v, want Lax", cookie.SameSite)
	}
	if cookie.Expires.IsZero() || !cookie.Expires.After(time.Now()) {
		t.Errorf("the cookie should carry a future expiry, got %v", cookie.Expires)
	}

	var payload loginResponse
	if err := json.NewDecoder(recorder.Body).Decode(&payload); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if payload.User.ID != api.users["LECTURER"] || payload.User.Role != "LECTURER" {
		t.Fatalf("unexpected user in the login payload: %+v", payload.User)
	}
	if payload.Token == "" || payload.ExpiresAt == "" {
		t.Fatalf("login should hand out a token and an expiry: %+v", payload)
	}
	if len(payload.Modules) == 0 || len(payload.Permissions) == 0 {
		t.Fatalf("login should report modules and permissions: %+v", payload)
	}

	// The cookie is enough on its own: no identity in the request, no token.
	me := api.post(http.MethodGet, "/api/me", nil, cookie)
	if me.Code != http.StatusOK {
		t.Fatalf("me: status %d body %s", me.Code, me.Body.String())
	}
	var current loginResponse
	if err := json.NewDecoder(me.Body).Decode(&current); err != nil {
		t.Fatalf("decode me: %v", err)
	}
	if current.User.ID != api.users["LECTURER"] || current.User.Role != "LECTURER" {
		t.Fatalf("me resolved the wrong caller: %+v", current.User)
	}
	if current.ExpiresAt == "" {
		t.Error("me should report when the session ends")
	}
	for _, key := range []string{"subjects.manage", "grades.manage", "academic.view"} {
		if !contains(current.Permissions, key) {
			t.Errorf("lecturer permissions missing %s: %v", key, current.Permissions)
		}
	}
	if contains(current.Permissions, "users.manage") {
		t.Errorf("lecturer should not hold users.manage: %v", current.Permissions)
	}
}

func TestBearerTokenIsAcceptedWithoutTheCookie(t *testing.T) {
	api := newAuthAPI(t)
	_, payload := api.signIn("STUDENT")

	request := httptest.NewRequest(http.MethodGet, "/api/me", nil)
	request.Header.Set("Authorization", "Bearer "+payload.Token)
	recorder := httptest.NewRecorder()
	api.app.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("bearer: status %d body %s", recorder.Code, recorder.Body.String())
	}
	var current loginResponse
	if err := json.NewDecoder(recorder.Body).Decode(&current); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if current.User.ID != api.users["STUDENT"] {
		t.Fatalf("bearer resolved the wrong caller: %+v", current.User)
	}
}

func TestExpiredSessionIsRefusedAndDropped(t *testing.T) {
	api := newAuthAPI(t)
	cookie, _ := api.signIn("ADMIN")

	// Age the session past its expiry, as twelve idle hours would.
	past := time.Now().UTC().Add(-time.Minute).Format(time.RFC3339)
	if _, err := api.db.Exec(`UPDATE sessions SET expires_at = ? WHERE user_id = ?`, past, api.users["ADMIN"]); err != nil {
		t.Fatalf("age session: %v", err)
	}

	recorder := api.post(http.MethodGet, "/api/me", nil, cookie)
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expired session: status %d, want 401", recorder.Code)
	}
	var remaining int
	if err := api.db.QueryRow(`SELECT COUNT(*) FROM sessions WHERE user_id = ?`, api.users["ADMIN"]).
		Scan(&remaining); err != nil {
		t.Fatal(err)
	}
	if remaining != 0 {
		t.Errorf("the expired row should be swept, %d left", remaining)
	}
}

func TestLogoutRevokesOnlyThatSession(t *testing.T) {
	api := newAuthAPI(t)
	first, _ := api.signIn("ADMIN")
	second, _ := api.signIn("ADMIN")

	if recorder := api.post(http.MethodGet, "/api/me", nil, first); recorder.Code != http.StatusOK {
		t.Fatalf("first session: status %d", recorder.Code)
	}

	if recorder := api.post(http.MethodPost, "/api/auth/logout", nil, first); recorder.Code != http.StatusNoContent {
		t.Fatalf("logout: status %d body %s", recorder.Code, recorder.Body.String())
	}
	if recorder := api.post(http.MethodGet, "/api/me", nil, first); recorder.Code != http.StatusUnauthorized {
		t.Fatalf("after logout the old cookie still works: status %d", recorder.Code)
	}
	if recorder := api.post(http.MethodGet, "/api/me", nil, second); recorder.Code != http.StatusOK {
		t.Fatalf("logging out one device killed the other: status %d", recorder.Code)
	}
	// Logging out twice is not an error.
	if recorder := api.post(http.MethodPost, "/api/auth/logout", nil, first); recorder.Code != http.StatusNoContent {
		t.Fatalf("second logout: status %d", recorder.Code)
	}
}

/* --- the allow-list and the 401 ------------------------------------------- */

func TestOnlyThePublicRoutesAnswerWithoutASession(t *testing.T) {
	api := newAuthAPI(t)

	for _, path := range []string{"/api/health", "/api/meta"} {
		if recorder := api.post(http.MethodGet, path, nil, nil); recorder.Code != http.StatusOK {
			t.Errorf("%s should be public: status %d", path, recorder.Code)
		}
	}

	protected := []struct{ method, path string }{
		{http.MethodGet, "/api/users"},
		{http.MethodGet, "/api/subjects"},
		{http.MethodGet, "/api/notifications"},
		{http.MethodGet, "/api/me"},
		{http.MethodGet, "/api/me/two-factor"},
		{http.MethodGet, "/api/ai/settings"},
		{http.MethodGet, "/api/mcp/tools"},
		{http.MethodPost, "/api/mcp"},
		{http.MethodPost, "/api/subjects"},
		{http.MethodGet, "/api/no-such-route"},
	}
	for _, route := range protected {
		if recorder := api.post(route.method, route.path, nil, nil); recorder.Code != http.StatusUnauthorized {
			t.Errorf("%s %s without a session: status %d, want 401", route.method, route.path, recorder.Code)
		}
	}

	// A forged token is as good as none.
	forged := &http.Cookie{Name: sessionCookieName, Value: "not-a-real-token"}
	if recorder := api.post(http.MethodGet, "/api/me", nil, forged); recorder.Code != http.StatusUnauthorized {
		t.Errorf("forged cookie: status %d, want 401", recorder.Code)
	}

	// The login endpoint itself stays reachable, and still refuses bad passwords.
	if recorder := api.post(http.MethodPost, "/api/auth/login", map[string]string{
		"email": "student@optimolms.dev", "password": "wrong-password",
	}, nil); recorder.Code != http.StatusUnauthorized {
		t.Errorf("bad password: status %d, want 401", recorder.Code)
	}
}

/* --- 403: permissions and admin-only routes -------------------------------- */

func TestPermissionMatrix(t *testing.T) {
	api := newAuthAPI(t)

	cases := []struct {
		name   string
		role   string
		method string
		path   string
		body   any
		want   int
	}{
		// Reading a module needs its *.view permission.
		{"student lists users", "STUDENT", http.MethodGet, "/api/users", nil, http.StatusForbidden},
		{"lecturer lists users", "LECTURER", http.MethodGet, "/api/users", nil, http.StatusForbidden},
		{"admin lists users", "ADMIN", http.MethodGet, "/api/users", nil, http.StatusOK},
		{"student lists subjects", "STUDENT", http.MethodGet, "/api/subjects", nil, http.StatusOK},
		{"lecturer lists subjects", "LECTURER", http.MethodGet, "/api/subjects", nil, http.StatusOK},

		// Writing needs *.manage.
		{"student creates a subject", "STUDENT", http.MethodPost, "/api/subjects",
			map[string]any{"name": "Nope", "code": "NO1"}, http.StatusForbidden},
		{"lecturer creates a subject", "LECTURER", http.MethodPost, "/api/subjects",
			map[string]any{"name": "Ethics", "code": "ETH1"}, http.StatusCreated},
		{"lecturer creates a campus", "LECTURER", http.MethodPost, "/api/campuses",
			map[string]any{"name": "North"}, http.StatusForbidden},
		{"admin creates a campus", "ADMIN", http.MethodPost, "/api/campuses",
			map[string]any{"name": "North"}, http.StatusCreated},

		// academic.view is a lecturer grant; academic.manage is not.
		{"lecturer reads academic structure", "LECTURER", http.MethodGet, "/api/academic", nil, http.StatusOK},
		{"lecturer creates a faculty", "LECTURER", http.MethodPost, "/api/faculties",
			map[string]any{"name": "Engineering"}, http.StatusForbidden},
		{"admin creates a faculty", "ADMIN", http.MethodPost, "/api/faculties",
			map[string]any{"name": "Science"}, http.StatusCreated},

		// Administrator-only routes, whatever the role holds elsewhere.
		{"student creates a role", "STUDENT", http.MethodPost, "/api/roles",
			map[string]any{"name": "LIBRARIAN"}, http.StatusForbidden},
		{"lecturer creates a role", "LECTURER", http.MethodPost, "/api/roles",
			map[string]any{"name": "LIBRARIAN"}, http.StatusForbidden},
		{"admin creates a role", "ADMIN", http.MethodPost, "/api/roles",
			map[string]any{"name": "LIBRARIAN"}, http.StatusCreated},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			recorder := api.asRole(c.role, c.method, c.path, c.body)
			if recorder.Code != c.want {
				t.Fatalf("%s %s as %s: status %d (want %d) body %s",
					c.method, c.path, c.role, recorder.Code, c.want, recorder.Body.String())
			}
		})
	}
}

func TestAdminOnlyTargetedActionsRejectOtherRoles(t *testing.T) {
	api := newAuthAPI(t)
	target := api.users["STUDENT"]

	path := "/api/users/" + target + "/two-factor/reset"
	if recorder := api.asRole("LECTURER", http.MethodPost, path, nil); recorder.Code != http.StatusForbidden {
		t.Fatalf("lecturer resetting someone's 2FA: status %d, want 403", recorder.Code)
	}
	if recorder := api.asRole("STUDENT", http.MethodPost, path, nil); recorder.Code != http.StatusForbidden {
		t.Fatalf("student resetting their own 2FA by path: status %d, want 403", recorder.Code)
	}
	if recorder := api.asRole("ADMIN", http.MethodPost, path, nil); recorder.Code != http.StatusOK {
		t.Fatalf("admin reset: status %d body %s", recorder.Code, recorder.Body.String())
	}

	permissions := "/api/users/" + target + "/permissions"
	if recorder := api.asRole("LECTURER", http.MethodPut, permissions,
		map[string]any{"permission_keys": []string{"users.manage"}}); recorder.Code != http.StatusForbidden {
		t.Fatalf("lecturer granting permissions: status %d, want 403", recorder.Code)
	}
	if recorder := api.asRole("ADMIN", http.MethodPut, permissions,
		map[string]any{"permission_keys": []string{}}); recorder.Code != http.StatusOK {
		t.Fatalf("admin permission override: status %d body %s", recorder.Code, recorder.Body.String())
	}
}

// TestIdentityComesFromTheSessionNotTheRequest is the property the whole change
// exists for: a client that names somebody else gets nothing of theirs.
func TestIdentityComesFromTheSessionNotTheRequest(t *testing.T) {
	api := newAuthAPI(t)
	studentCookie, _ := api.signIn("STUDENT")

	// A notification that belongs to the admin.
	now := util.Now()
	adminNotification := util.NewID()
	if _, err := api.db.Exec(`
		INSERT INTO notifications (id, user_id, title, message, created_at)
		VALUES (?, ?, 'Mine', 'admin only', ?)`, adminNotification, api.users["ADMIN"], now); err != nil {
		t.Fatalf("insert notification: %v", err)
	}

	// Whatever the query string claims, the feed is the caller's own.
	recorder := api.post(http.MethodGet, "/api/notifications?user_id="+api.users["ADMIN"], nil, studentCookie)
	if recorder.Code != http.StatusOK {
		t.Fatalf("notifications: status %d body %s", recorder.Code, recorder.Body.String())
	}
	var feed []notificationOut
	if err := json.NewDecoder(recorder.Body).Decode(&feed); err != nil {
		t.Fatalf("decode: %v", err)
	}
	for _, item := range feed {
		if item.ID == adminNotification {
			t.Fatalf("the caller read somebody else's notifications: %+v", feed)
		}
	}

	// Marking it read by id does not reach it either.
	if recorder := api.post(http.MethodPost, "/api/notifications/"+adminNotification+"/read", nil, studentCookie); recorder.Code != http.StatusOK {
		t.Fatalf("mark read: status %d", recorder.Code)
	}
	var readAt sql.NullString
	if err := api.db.QueryRow(`SELECT read_at FROM notifications WHERE id = ?`, adminNotification).Scan(&readAt); err != nil {
		t.Fatal(err)
	}
	if readAt.Valid {
		t.Error("a notification was marked read by someone it does not belong to")
	}

	// A chat session created by the admin is invisible to the student, and the
	// body cannot wish it into existence.
	adminChat := util.NewID()
	if _, err := api.db.Exec(`INSERT INTO ai_chat_sessions (id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?)`,
		adminChat, api.users["ADMIN"], now, now); err != nil {
		t.Fatalf("insert chat: %v", err)
	}
	recorder = api.post(http.MethodGet, "/api/ai/sessions/"+adminChat+"?user_id="+api.users["ADMIN"], nil, studentCookie)
	if recorder.Code != http.StatusNotFound {
		t.Fatalf("student read the admin's chat: status %d", recorder.Code)
	}

	// Appearance follows the session too.
	if recorder := api.post(http.MethodPut, "/api/me/appearance",
		map[string]any{"user_id": api.users["ADMIN"], "theme": "dark", "font": "system"}, studentCookie); recorder.Code != http.StatusOK {
		t.Fatalf("appearance: status %d body %s", recorder.Code, recorder.Body.String())
	}
	var adminTheme string
	if err := api.db.QueryRow(`SELECT theme FROM user_appearance WHERE user_id = ?`, api.users["ADMIN"]).Scan(&adminTheme); err == nil {
		t.Errorf("the body's user_id changed the admin's appearance: %q", adminTheme)
	}
	var studentTheme string
	if err := api.db.QueryRow(`SELECT theme FROM user_appearance WHERE user_id = ?`, api.users["STUDENT"]).Scan(&studentTheme); err != nil {
		t.Fatalf("student appearance not written: %v", err)
	}
	if studentTheme != "dark" {
		t.Errorf("student theme = %q, want dark", studentTheme)
	}
}

/* --- the two-factor handshake -------------------------------------------- */

// enrolTwoFactor turns 2FA on for userID with the same cipher the server uses,
// and returns the shared secret.
func (api *authAPI) enrolTwoFactor(userID string) string {
	api.t.Helper()
	crypt, err := keycrypt.NewLabeled(api.cfg.EncryptionSecret, "user-totp-secret")
	if err != nil {
		api.t.Fatalf("cipher: %v", err)
	}
	service := &twoFactorService{db: api.db, crypt: crypt}
	ctx := context.Background()
	setup, err := service.startSetup(ctx, userID)
	if err != nil {
		api.t.Fatalf("setup: %v", err)
	}
	code, err := totp.Code(setup.Secret, time.Now())
	if err != nil {
		api.t.Fatalf("code: %v", err)
	}
	if _, err := service.enable(ctx, userID, code); err != nil {
		api.t.Fatalf("enable: %v", err)
	}
	return setup.Secret
}

func TestTwoFactorStepIssuesARealSession(t *testing.T) {
	api := newAuthAPI(t)
	secret := api.enrolTwoFactor(api.users["STUDENT"])

	// The password alone buys a ticket, not a session.
	first := api.post(http.MethodPost, "/api/auth/login", map[string]string{
		"email": "student@optimolms.dev", "password": "student123",
	}, nil)
	if first.Code != http.StatusOK {
		t.Fatalf("login: status %d body %s", first.Code, first.Body.String())
	}
	for _, cookie := range first.Result().Cookies() {
		if cookie.Name == sessionCookieName && cookie.Value != "" {
			t.Fatal("the password step must not issue a session on a 2FA account")
		}
	}
	var challenge loginChallengeResponse
	if err := json.NewDecoder(first.Body).Decode(&challenge); err != nil {
		t.Fatalf("decode challenge: %v", err)
	}
	if !challenge.TwoFactorRequired || challenge.Challenge == "" {
		t.Fatalf("expected a challenge: %+v", challenge)
	}

	// The ticket alone is not a session either.
	if recorder := api.post(http.MethodGet, "/api/me", nil, nil); recorder.Code != http.StatusUnauthorized {
		t.Fatalf("me before the code step: status %d", recorder.Code)
	}

	code, err := totp.Code(secret, time.Now())
	if err != nil {
		t.Fatalf("code: %v", err)
	}
	second := api.post(http.MethodPost, "/api/auth/login/2fa",
		map[string]string{"challenge": challenge.Challenge, "code": code}, nil)
	if second.Code != http.StatusOK {
		t.Fatalf("2fa step: status %d body %s", second.Code, second.Body.String())
	}
	cookie := sessionCookie(t, second)

	recorder := api.post(http.MethodGet, "/api/me", nil, cookie)
	if recorder.Code != http.StatusOK {
		t.Fatalf("me after the code step: status %d body %s", recorder.Code, recorder.Body.String())
	}
	var current loginResponse
	if err := json.NewDecoder(recorder.Body).Decode(&current); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if current.User.ID != api.users["STUDENT"] {
		t.Fatalf("2FA session resolved the wrong caller: %+v", current.User)
	}

	// The ticket burned with that sign-in.
	again := api.post(http.MethodPost, "/api/auth/login/2fa",
		map[string]string{"challenge": challenge.Challenge, "code": code}, nil)
	if again.Code != http.StatusUnauthorized {
		t.Fatalf("a spent ticket was accepted: status %d body %s", again.Code, again.Body.String())
	}
}

func TestLockoutStillAppliesAfterTheCodeStep(t *testing.T) {
	api := newAuthAPI(t)
	api.enrolTwoFactor(api.users["STUDENT"])

	first := api.post(http.MethodPost, "/api/auth/login", map[string]string{
		"email": "student@optimolms.dev", "password": "student123",
	}, nil)
	var challenge loginChallengeResponse
	if err := json.NewDecoder(first.Body).Decode(&challenge); err != nil {
		t.Fatalf("decode: %v", err)
	}

	// Five wrong codes burn the ticket and the account's attempts. The last of
	// them locks the account (the seeded STUDENT role allows five tries), which
	// the endpoint reports as 423 rather than 401.
	for i := 0; i < 5; i++ {
		recorder := api.post(http.MethodPost, "/api/auth/login/2fa",
			map[string]string{"challenge": challenge.Challenge, "code": "000000"}, nil)
		if recorder.Code != http.StatusUnauthorized && recorder.Code != http.StatusLocked {
			t.Fatalf("wrong code %d: status %d body %s", i, recorder.Code, recorder.Body.String())
		}
	}
	burned := api.post(http.MethodPost, "/api/auth/login/2fa",
		map[string]string{"challenge": challenge.Challenge, "code": "000000"}, nil)
	if burned.Code != http.StatusUnauthorized {
		t.Fatalf("the burned ticket was still usable: status %d", burned.Code)
	}
	var left int
	if err := api.db.QueryRow(`SELECT failed_login_attempts FROM users WHERE id = ?`, api.users["STUDENT"]).
		Scan(&left); err != nil {
		t.Fatal(err)
	}
	if left == 0 {
		t.Error("wrong codes should count against the account's lockout")
	}
}

/* --- helpers the other registry tests reuse -------------------------------- */

// asUser resolves userID and returns a request that already carries the caller.
// A test that drives one registry on its own uses this instead of the session
// middleware; the handler code is identical either way.
func asUser(t *testing.T, database *sql.DB, userID string, r *http.Request) *http.Request {
	t.Helper()
	user, err := loadCaller(r.Context(), database, userID)
	if err != nil {
		t.Fatalf("load caller %s: %v", userID, err)
	}
	return r.WithContext(withCaller(r.Context(), user))
}

// callAs performs one request against a bare mux as a signed-in user.
func callAs(t *testing.T, database *sql.DB, mux *http.ServeMux, userID, method, path string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var reader *bytes.Reader
	if body == nil {
		reader = bytes.NewReader(nil)
	} else {
		payload, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
		reader = bytes.NewReader(payload)
	}
	request := httptest.NewRequest(method, path, reader)
	request.Header.Set("Content-Type", "application/json")
	request = asUser(t, database, userID, request)
	recorder := httptest.NewRecorder()
	mux.ServeHTTP(recorder, request)
	return recorder
}

func contains(values []string, want string) bool {
	for _, value := range values {
		if value == want {
			return true
		}
	}
	return false
}
