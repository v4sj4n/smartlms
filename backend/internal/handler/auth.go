package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"optimolms/backend/internal/auth"
	"optimolms/backend/internal/util"
)

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// sessionUserOut is the caller as every signed-in response describes them.
type sessionUserOut struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
	Role  string `json:"role"`
}

// loginResponse is what a completed sign-in returns, and what GET /api/me
// returns on every later page load: the account, the modules its role reaches,
// the effective permission keys, and when the session stops working.
//
// Token is only set by the endpoints that mint a session. A browser ignores it —
// the same value already arrived in the HttpOnly cookie — while a non-browser
// client (an MCP client, a script) keeps it and sends it back as
// `Authorization: Bearer <token>`.
type loginResponse struct {
	User        sessionUserOut `json:"user"`
	Modules     []string       `json:"modules"`
	Permissions []string       `json:"permissions"`
	ExpiresAt   string         `json:"expires_at,omitempty"`
	Token       string         `json:"token,omitempty"`
}

// loginChallengeResponse is the answer to a correct password on an account with
// two-factor on: the password bought a ticket for the code step, and nothing
// signed-in is handed out yet.
type loginChallengeResponse struct {
	TwoFactorRequired bool           `json:"two_factor_required"`
	Challenge         string         `json:"challenge"`
	ExpiresAt         string         `json:"expires_at"`
	User              map[string]any `json:"user"`
}

// loginPolicy is the per-role lockout configuration of one account.
type loginPolicy struct {
	failed      int
	lockedUntil sql.NullString
	maxAttempts sql.NullInt64
	lockMinutes int
}

// recordFailedAttempt increments the failure counter and applies the role's
// lockout policy. It returns how many attempts are left (-1 when the role allows
// unlimited tries) and, when this attempt locked the account, the RFC3339 expiry.
func recordFailedAttempt(ctx context.Context, db *sql.DB, userID string, policy loginPolicy) (int, string, error) {
	failed := policy.failed + 1
	attemptsLeft := -1
	lockedUntil := ""
	if policy.maxAttempts.Valid {
		if int64(failed) >= policy.maxAttempts.Int64 {
			attemptsLeft = 0
			lockedUntil = time.Now().UTC().
				Add(time.Duration(policy.lockMinutes) * time.Minute).
				Format(time.RFC3339)
		} else {
			attemptsLeft = int(policy.maxAttempts.Int64) - failed
		}
	}
	var lockValue any
	if lockedUntil != "" {
		lockValue = lockedUntil
	}
	if _, err := db.ExecContext(ctx,
		`UPDATE users SET failed_login_attempts = ?, locked_until = ?, updated_at = ? WHERE id = ?`,
		failed, lockValue, util.Now(), userID); err != nil {
		return 0, "", err
	}
	return attemptsLeft, lockedUntil, nil
}

// clearFailedAttempts resets the lockout counters once a sign-in really
// completed, which for a two-factor account is after the code step, not after
// the password step.
func clearFailedAttempts(ctx context.Context, db *sql.DB, userID string) error {
	_, err := db.ExecContext(ctx,
		`UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = ? WHERE id = ?`,
		util.Now(), userID)
	return err
}

// registerAuth wires POST /api/auth/login with per-role lockout: after
// roles.max_login_attempts consecutive failures the account is locked for
// roles.lock_minutes. A NULL max_login_attempts means unlimited tries.
//
// An account with two-factor on gets no session from this endpoint: the correct
// password earns a challenge ticket, and POST /api/auth/login/2fa trades that
// ticket plus a code for the session.
func registerAuth(mux *http.ServeMux, db *sql.DB, twoFactor *twoFactorService, sessions *sessionStore) {
	mux.HandleFunc("POST /api/auth/login", func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		var req loginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}

		var (
			id, email, hash, name, roleName string
			failed                          int
			lockedUntil                     sql.NullString
			maxAttempts                     sql.NullInt64
			lockMinutes                     int
			totpEnabledAt                   sql.NullString
		)
		err := db.QueryRowContext(ctx, `
			SELECT u.id, u.email, u.password_hash, u.name, r.name,
			       u.failed_login_attempts, u.locked_until,
			       r.max_login_attempts, r.lock_minutes, u.totp_enabled_at
			FROM users u JOIN roles r ON r.id = u.role_id
			WHERE u.email = ?`, req.Email).
			Scan(&id, &email, &hash, &name, &roleName, &failed, &lockedUntil, &maxAttempts, &lockMinutes, &totpEnabledAt)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		now := time.Now().UTC()

		// locked?
		if lockedUntil.Valid && lockedUntil.String != "" {
			if lockTime, err := time.Parse(time.RFC3339, lockedUntil.String); err == nil && now.Before(lockTime) {
				writeJSON(w, http.StatusLocked, map[string]string{
					"error":        "account locked due to too many failed attempts",
					"locked_until": lockTime.UTC().Format(time.RFC3339),
				})
				return
			}
		}

		ok, err := auth.VerifyPassword(req.Password, hash)
		if err != nil || !ok {
			attemptsLeft, lockExpiry, err := recordFailedAttempt(ctx, db, id, loginPolicy{
				failed:      failed,
				lockedUntil: lockedUntil,
				maxAttempts: maxAttempts,
				lockMinutes: lockMinutes,
			})
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			resp := map[string]any{"error": "invalid credentials"}
			if attemptsLeft >= 0 {
				resp["attempts_left"] = attemptsLeft
			}
			if lockExpiry != "" {
				resp["error"] = "account locked due to too many failed attempts"
				resp["locked_until"] = lockExpiry
				writeJSON(w, http.StatusLocked, resp)
				return
			}
			writeJSON(w, http.StatusUnauthorized, resp)
			return
		}

		// The password was right. With two-factor on that is only the first
		// half: hand out a ticket and leave the failure counters alone until
		// the code step completes, so an abandoned second step is not a free
		// reset of the lockout.
		if totpEnabledAt.Valid && totpEnabledAt.String != "" {
			ticket, err := twoFactor.issueChallenge(ctx, id)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, loginChallengeResponse{
				TwoFactorRequired: true,
				Challenge:         ticket.token,
				ExpiresAt:         ticket.expiresAt,
				User: map[string]any{
					"id": id, "email": email, "name": name,
				},
			})
			return
		}

		if err := clearFailedAttempts(ctx, db, id); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		// The password is the whole story for an account without two-factor:
		// mint the session here and hand it over in the cookie.
		payload, err := issueSessionFor(w, r, sessions, id)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})
}
