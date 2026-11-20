package handler

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"errors"
	"net/http"
	"strings"
	"time"

	"optimolms/backend/internal/util"
)

/*
Sessions and authorization.

A sign-in ends with one opaque random token. Only its SHA-256 hash is stored
(migration 000019), and the token travels two ways:

	browser     the `optimolms_session` cookie — HttpOnly, SameSite=Lax,
	            Path=/, so a page script cannot read it and a cross-site form
	            cannot spend it
	everything  `Authorization: Bearer <token>`, for MCP clients and scripts
	else

Every request is resolved through withSessions, which is the only place identity
enters a request. It loads the caller (role, modules, effective permissions from
the database, so a permission change takes effect on the next request), checks
the route's policy, and hands the caller to the handler through the request
context. Handlers therefore never read a user id from the client: no query
parameter or identity header decides who is calling. A user id may still appear
in a path, but only as the *target* of an administrator's action.
*/

const (
	// sessionCookieName is the cookie the browser carries the token in.
	sessionCookieName = "optimolms_session"
	// sessionTTL is how long a sign-in lasts. It is absolute, not sliding: a
	// stolen token stops working at a known moment.
	sessionTTL = 12 * time.Hour
	// sessionUserAgentLimit keeps a pathological header out of the table.
	sessionUserAgentLimit = 200
)

// errNoUser is already declared in two_factor.go; sessions reuse it.

/* --- the caller ----------------------------------------------------------- */

// caller is the signed-in person, resolved once per request.
type caller struct {
	ID          string
	Email       string
	Name        string
	Role        string
	Modules     []string
	Permissions []string
	// SessionExpiresAt is the RFC3339 expiry of the session that resolved to
	// this caller, reported by GET /api/me.
	SessionExpiresAt string

	permissions map[string]struct{}
}

func (c *caller) isAdmin() bool { return c.Role == "ADMIN" }

// can reports whether the caller's effective permissions cover key. ADMIN holds
// every permission in the catalogue, so it always passes.
func (c *caller) can(key string) bool {
	if key == "" {
		return true
	}
	if c.permissions == nil {
		c.permissions = make(map[string]struct{}, len(c.Permissions))
		for _, granted := range c.Permissions {
			c.permissions[granted] = struct{}{}
		}
	}
	_, ok := c.permissions[key]
	return ok
}

// hasModule reports whether the role reaches a UI module.
func (c *caller) hasModule(key string) bool {
	for _, module := range c.Modules {
		if module == key {
			return true
		}
	}
	return false
}

// payload is the body login, the 2FA step and GET /api/me all return: who the
// caller is, what their role reaches, and the exact permissions they hold.
func (c *caller) payload() loginResponse {
	modules := c.Modules
	if modules == nil {
		modules = []string{}
	}
	permissions := c.Permissions
	if permissions == nil {
		permissions = []string{}
	}
	return loginResponse{
		User: sessionUserOut{
			ID: c.ID, Email: c.Email, Name: c.Name, Role: c.Role,
		},
		Modules:     modules,
		Permissions: permissions,
		ExpiresAt:   c.SessionExpiresAt,
	}
}

type callerKey struct{}

func withCaller(ctx context.Context, c *caller) context.Context {
	return context.WithValue(ctx, callerKey{}, c)
}

// callerFrom returns the caller resolved for this request. It is never nil: a
// request that reached a handler without a session carries the zero caller, and
// the middleware is what stops those requests earlier.
func callerFrom(r *http.Request) *caller {
	if c, ok := r.Context().Value(callerKey{}).(*caller); ok && c != nil {
		return c
	}
	return &caller{}
}

// loadCaller reads everything a request needs about one account: role, module
// access and the effective permission keys (role grants plus per-user extras).
func loadCaller(ctx context.Context, db *sql.DB, userID string) (*caller, error) {
	c := &caller{ID: userID}
	err := db.QueryRowContext(ctx, `
		SELECT u.email, u.name, r.name
		FROM users u JOIN roles r ON r.id = u.role_id
		WHERE u.id = ?`, userID).Scan(&c.Email, &c.Name, &c.Role)
	if err != nil {
		return nil, err
	}
	modules, err := accessibleModules(ctx, db, userID)
	if err != nil {
		return nil, err
	}
	permissions, err := effectivePermissionKeys(ctx, db, userID)
	if err != nil {
		return nil, err
	}
	c.Modules = modules
	c.Permissions = permissions
	return c, nil
}

/* --- the session store ---------------------------------------------------- */

// sessionStore owns the sessions table. now is injectable so tests can age a
// session without sleeping.
type sessionStore struct {
	db  *sql.DB
	now func() time.Time
}

func (s *sessionStore) clock() time.Time {
	if s.now != nil {
		return s.now().UTC()
	}
	return time.Now().UTC()
}

// issue mints a session for userID and returns the token plus its expiry. The
// token is random (32 bytes), never derived from the account.
func (s *sessionStore) issue(ctx context.Context, userID, userAgent string) (string, time.Time, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", time.Time{}, err
	}
	token := base64.RawURLEncoding.EncodeToString(raw)
	now := s.clock()
	expires := now.Add(sessionTTL)
	if _, err := s.db.ExecContext(ctx, `
		INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, last_seen_at, user_agent)
		VALUES (?, ?, ?, ?, ?, NULL, ?)`,
		util.NewID(), userID, hashToken(token),
		now.Format(time.RFC3339), expires.Format(time.RFC3339),
		userAgentHint(userAgent)); err != nil {
		return "", time.Time{}, err
	}
	return token, expires, nil
}

// sessionRow is one resolved session before the account is loaded.
type sessionRow struct {
	ID        string
	UserID    string
	ExpiresAt string
}

// lookup resolves a token to its session, dropping it when it has expired.
func (s *sessionStore) lookup(ctx context.Context, token string) (sessionRow, error) {
	var row sessionRow
	var expiresAt string
	err := s.db.QueryRowContext(ctx, `
		SELECT id, user_id, expires_at FROM sessions WHERE token_hash = ?`,
		hashToken(token)).Scan(&row.ID, &row.UserID, &expiresAt)
	if err != nil {
		return sessionRow{}, err
	}
	expiry, err := time.Parse(time.RFC3339, expiresAt)
	if err != nil || !s.clock().Before(expiry) {
		_, _ = s.db.ExecContext(ctx, `DELETE FROM sessions WHERE id = ?`, row.ID)
		return sessionRow{}, sql.ErrNoRows
	}
	row.ExpiresAt = expiresAt
	if _, err := s.db.ExecContext(ctx,
		`UPDATE sessions SET last_seen_at = ? WHERE id = ?`, s.clock().Format(time.RFC3339), row.ID); err != nil {
		return sessionRow{}, err
	}
	return row, nil
}

// revoke deletes one token: signing out this device, not every device.
func (s *sessionStore) revoke(ctx context.Context, token string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM sessions WHERE token_hash = ?`, hashToken(token))
	return err
}

// revokeExpired sweeps sessions that are past their expiry. Sign-in calls it so
// the table cannot grow without bound on a long-lived deployment.
func (s *sessionStore) revokeExpired(ctx context.Context) {
	_, _ = s.db.ExecContext(ctx, `DELETE FROM sessions WHERE expires_at < ?`, s.clock().Format(time.RFC3339))
}

func userAgentHint(userAgent string) any {
	trimmed := strings.TrimSpace(userAgent)
	if trimmed == "" {
		return nil
	}
	if len(trimmed) > sessionUserAgentLimit {
		trimmed = trimmed[:sessionUserAgentLimit]
	}
	return trimmed
}

/* --- cookie + token plumbing ---------------------------------------------- */

// sessionToken reads the credential: the cookie for browsers, the Authorization
// header for everything else.
func sessionToken(r *http.Request) string {
	if cookie, err := r.Cookie(sessionCookieName); err == nil {
		if token := strings.TrimSpace(cookie.Value); token != "" {
			return token
		}
	}
	header := strings.TrimSpace(r.Header.Get("Authorization"))
	if len(header) > 7 && strings.EqualFold(header[:7], "bearer ") {
		return strings.TrimSpace(header[7:])
	}
	return ""
}

// setSessionCookie hands the token to the browser. Secure stays false because
// development is plain http on localhost; a TLS deployment should flip it (the
// Vite dev server proxies /api, so the cookie is same-site and SameSite=Lax is
// enough to block cross-site form posts).
func setSessionCookie(w http.ResponseWriter, token string, expires time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Expires:  expires,
		MaxAge:   int(time.Until(expires).Seconds()),
	})
}

func clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
}

/* --- authorization policy ------------------------------------------------- */

// policy says who may reach one route. The zero value means "anybody with a
// session".
type policy struct {
	public bool   // no session needed
	admin  bool   // ADMIN role only
	perm   string // permission key the caller must hold
}

// exactPolicy holds the routes whose requirement cannot be derived from the
// resource family, plus everything public or administrator-only.
var exactPolicy = map[string]policy{
	// Public: signing in, signing out, and the two read-only endpoints the
	// login screen and the module catalogue need.
	"POST /api/auth/login":     {public: true},
	"POST /api/auth/login/2fa": {public: true},
	"POST /api/auth/logout":    {public: true},
	"GET /api/health":          {public: true},
	"GET /api/meta":            {public: true},

	// Administrator surface: roles, permission overrides, and clearing
	// somebody else's two-factor. Only the ADMIN role reaches these.
	"POST /api/roles":                           {admin: true},
	"PUT /api/roles/{roleID}/permissions":       {admin: true},
	"GET /api/users/{userID}/permissions":       {admin: true},
	"PUT /api/users/{userID}/permissions":       {admin: true},
	"POST /api/users/{userID}/two-factor/reset": {admin: true},

	// Writes and reads where the method alone would pick the wrong permission.
	"PATCH /api/threads/{id}":                {perm: "forums.moderate"},
	"POST /api/assignments/{id}/submissions": {perm: "assignments.submit"},
	"PATCH /api/submissions/{id}":            {perm: "assignments.grade"},
	"POST /api/quizzes/{id}/attempts":        {perm: "quizzes.take"},
	"POST /api/attempts/{id}/submit":         {perm: "quizzes.take"},
	"GET /api/ai/chat-models":                {perm: PermAssistantUse},
	"POST /api/ai/chat":                      {perm: PermAssistantUse},
	"GET /api/students":                      {perm: "users.view"},

	// A student hands in the file itself and takes it back: narrower than the
	// /api/assignments family, where a write needs assignments.manage. Who owns
	// the submission is decided inside the handler.
	"PUT /api/assignments/{assignmentID}/submission/file":    {perm: "assignments.submit"},
	"DELETE /api/assignments/{assignmentID}/submission/file": {perm: "assignments.submit"},
	"GET /api/submissions/{submissionID}/file":               {perm: "assignments.view"},

	// The timetable is open to every signed-in caller: a student reads where
	// their next lecture is, a lecturer their own week, an administrator the
	// room plan. The writes that fill it stay behind lectures.manage.
	"GET /api/schedule": {},

	// General settings: every signed-in client reads the limits (the student
	// upload picker shows them before a file is chosen); only the holder of
	// settings.manage writes them, which is ADMIN at seed time.
	"GET /api/settings/general": {},
	"PUT /api/settings/general": {perm: "settings.manage"},
}

// policyFamily maps a pattern prefix to the permission a read and a write under
// it require. Order matters: the first match wins, so the specific families
// (/api/subjects/{id}/gradebook) come before the general ones (/api/subjects).
var policyFamilies = []struct {
	prefix string
	read   policy
	write  policy
}{
	{"/api/subjects/{id}/gradebook", policy{perm: "grades.view"}, policy{perm: "grades.manage"}},
	{"/api/subjects/{id}/grade-components", policy{perm: "grades.view"}, policy{perm: "grades.manage"}},
	{"/api/grade-components", policy{perm: "grades.view"}, policy{perm: "grades.manage"}},
	{"/api/subjects/{id}/assignments", policy{perm: "assignments.view"}, policy{perm: "assignments.manage"}},
	{"/api/assignments", policy{perm: "assignments.view"}, policy{perm: "assignments.manage"}},
	{"/api/submissions", policy{perm: "assignments.view"}, policy{perm: "assignments.view"}},
	{"/api/subjects/{id}/quizzes", policy{perm: "quizzes.view"}, policy{perm: "quizzes.manage"}},
	{"/api/quizzes", policy{perm: "quizzes.view"}, policy{perm: "quizzes.manage"}},
	{"/api/attempts", policy{perm: "quizzes.take"}, policy{perm: "quizzes.take"}},
	{"/api/subjects/{id}/flashcard-sets", policy{perm: "flashcards.view"}, policy{perm: "flashcards.manage"}},
	{"/api/flashcard-sets", policy{perm: "flashcards.view"}, policy{perm: "flashcards.manage"}},
	{"/api/subjects/{id}/lectures", policy{perm: "lectures.view"}, policy{perm: "lectures.manage"}},
	{"/api/lectures", policy{perm: "lectures.view"}, policy{perm: "lectures.manage"}},
	{"/api/subjects/{id}/weeks", policy{perm: "subjects.view"}, policy{perm: "subjects.manage"}},
	// Who sits in a course is part of the course, not of a separate family:
	// anybody who may read the subject sees the roster, only the holder of
	// subjects.manage changes it.
	{"/api/subjects/{id}/enrollments", policy{perm: "subjects.view"}, policy{perm: "subjects.manage"}},
	{"/api/weeks", policy{perm: "subjects.view"}, policy{perm: "subjects.manage"}},
	{"/api/subjects/{id}/forums", policy{perm: "forums.view"}, policy{perm: "forums.moderate"}},
	{"/api/forums", policy{perm: "forums.view"}, policy{perm: "forums.moderate"}},
	{"/api/threads", policy{perm: "forums.view"}, policy{perm: "forums.post"}},
	{"/api/posts", policy{perm: "forums.post"}, policy{perm: "forums.post"}},
	{"/api/subjects", policy{perm: "subjects.view"}, policy{perm: "subjects.manage"}},
	{"/api/students/{id}/results", policy{perm: "grades.override"}, policy{perm: "grades.override"}},
	{"/api/students/{id}/record", policy{perm: "records.view"}, policy{perm: "records.view"}},
	{"/api/students/{id}/grades", policy{perm: "grades.view"}, policy{perm: "grades.view"}},
	{"/api/students/{id}/quiz-attempts", policy{perm: "quizzes.view"}, policy{perm: "quizzes.view"}},
	{"/api/students/{id}/submissions", policy{perm: "assignments.view"}, policy{perm: "assignments.view"}},
	{"/api/programme-enrollments", policy{perm: "academic.view"}, policy{perm: "academic.manage"}},
	{"/api/programmes", policy{perm: "academic.view"}, policy{perm: "academic.manage"}},
	{"/api/faculties", policy{perm: "academic.view"}, policy{perm: "academic.manage"}},
	{"/api/departments", policy{perm: "academic.view"}, policy{perm: "academic.manage"}},
	{"/api/academic", policy{perm: "academic.view"}, policy{perm: "academic.manage"}},
	{"/api/campuses", policy{perm: "campuses.view"}, policy{perm: "campuses.manage"}},
	{"/api/stories", policy{perm: "campuses.view"}, policy{perm: "campuses.manage"}},
	{"/api/classes", policy{perm: "campuses.view"}, policy{perm: "campuses.manage"}},
	{"/api/school-years", policy{perm: "school-years.view"}, policy{perm: "school-years.manage"}},
	{"/api/users", policy{perm: "users.view"}, policy{perm: "users.manage"}},
	{"/api/grades/scales", policy{perm: "grades.view"}, policy{perm: "grades.view"}},
}

func readMethod(method string) bool {
	return method == http.MethodGet || method == http.MethodHead
}

// routePolicy answers "who may reach this route" from the ServeMux pattern that
// matched. A pattern is what is registered ("GET /api/subjects/{id}"), so the
// placeholders are part of the key, not the request path, and the method is
// part of the pattern for the entries that name one.
func routePolicy(method, pattern string) policy {
	if entry, ok := exactPolicy[pattern]; ok {
		return entry
	}
	path := pattern
	if _, rest, found := strings.Cut(pattern, " "); found {
		path = rest
	}
	for _, family := range policyFamilies {
		if strings.HasPrefix(path, family.prefix) {
			if readMethod(method) {
				return family.read
			}
			return family.write
		}
	}
	// /api/me/*, /api/notifications, /api/ai/*, /api/mcp: signed in, with the
	// finer rules enforced inside the handlers (assistant.configure, the
	// per-tool MCP permissions, ownership of a personal provider).
	return policy{}
}

/* --- middleware ----------------------------------------------------------- */

// withSessions is the request chain the app serves: resolve the caller, apply the
// route policy, then let the mux route with the caller in the request context.
func withSessions(mux *http.ServeMux, store *sessionStore) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Ask the mux which pattern this request would match, so the policy can
		// be applied before the handler runs. The mux routes again below; that
		// also fills in r.Pattern for anything that wants it.
		_, pattern := mux.Handler(r)
		rule := routePolicy(r.Method, pattern)

		if rule.public {
			mux.ServeHTTP(w, r.WithContext(withCaller(r.Context(), &caller{})))
			return
		}

		token := sessionToken(r)
		if token == "" {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "sign in to continue"})
			return
		}
		ctx := r.Context()
		row, err := store.lookup(ctx, token)
		if errors.Is(err, sql.ErrNoRows) {
			clearSessionCookie(w)
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "your session has expired, sign in again"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		user, err := loadCaller(ctx, store.db, row.UserID)
		if errors.Is(err, sql.ErrNoRows) {
			// The account went away while the session lived on.
			_ = store.revoke(ctx, token)
			clearSessionCookie(w)
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "your session has expired, sign in again"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		user.SessionExpiresAt = row.ExpiresAt

		switch {
		case rule.admin && !user.isAdmin():
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "only an administrator can do that"})
			return
		case rule.perm != "" && !user.can(rule.perm):
			writeJSON(w, http.StatusForbidden, map[string]string{
				"error": "your account does not hold the " + rule.perm + " permission",
			})
			return
		}

		mux.ServeHTTP(w, r.WithContext(withCaller(ctx, user)))
	})
}

// issueSessionFor mints a session and hands it to the caller: the cookie for a
// browser, and the token in the body so a non-browser client can keep it.
func issueSessionFor(w http.ResponseWriter, r *http.Request, store *sessionStore, userID string) (loginResponse, error) {
	ctx := r.Context()
	store.revokeExpired(ctx)

	token, expires, err := store.issue(ctx, userID, r.UserAgent())
	if err != nil {
		return loginResponse{}, err
	}
	setSessionCookie(w, token, expires)

	user, err := loadCaller(ctx, store.db, userID)
	if err != nil {
		return loginResponse{}, err
	}
	user.SessionExpiresAt = expires.Format(time.RFC3339)

	payload := user.payload()
	payload.Token = token
	return payload, nil
}

// allowStudentRecord guards the student-scoped reads: the person themselves, or
// somebody holding one of the staff permissions named by the caller.
func allowStudentRecord(r *http.Request, studentID string, staffPermissions ...string) bool {
	user := callerFrom(r)
	if user.ID != "" && user.ID == studentID {
		return true
	}
	for _, permission := range staffPermissions {
		if user.can(permission) {
			return true
		}
	}
	return false
}

/* --- routes --------------------------------------------------------------- */

// registerSession wires sign-out and the "who am I" endpoint.
func registerSession(mux *http.ServeMux, store *sessionStore) {
	// POST /api/auth/logout — drop this device's session. Idempotent: signing
	// out twice, or with a token that already expired, is not an error.
	mux.HandleFunc("POST /api/auth/logout", func(w http.ResponseWriter, r *http.Request) {
		if token := sessionToken(r); token != "" {
			if err := store.revoke(r.Context(), token); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
		}
		clearSessionCookie(w)
		w.WriteHeader(http.StatusNoContent)
	})

	// GET /api/me — the caller as the database sees them right now: identity,
	// role, module access, effective permissions and when the session ends. The
	// frontend hydrates from this instead of trusting its stored copy.
	mux.HandleFunc("GET /api/me", func(w http.ResponseWriter, r *http.Request) {
		user := callerFrom(r)
		if user.ID == "" {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "sign in to continue"})
			return
		}
		writeJSON(w, http.StatusOK, user.payload())
	})
}
