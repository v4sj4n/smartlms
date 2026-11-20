package handler

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"optimolms/backend/internal/auth"
	"optimolms/backend/internal/keycrypt"
	"optimolms/backend/internal/totp"
	"optimolms/backend/internal/util"
)

// Two-factor authentication for every account, driven by a TOTP authenticator
// app (RFC 6238). The moving parts:
//
//	password step      POST /api/auth/login answers with a challenge ticket
//	code step          POST /api/auth/login/2fa trades ticket + code for a session
//	enrolment          setup (secret + otpauth URI) → enable (first code) →
//	                   recovery codes, shown once and stored hashed
//	management         status, disable, regenerate recovery codes
//	way back in        an administrator can reset a locked-out account
//
// Everything here runs as the signed-in caller: the session names the account,
// and these handlers never read a user id from the client. The one exception is
// the administrator's reset, where the path id is the *target* and the route
// policy is what requires an ADMIN session. Passwords are re-checked for
// operations that weaken an account's security.

const (
	twoFactorIssuer = "OptimoLMS"
	// challengeTTL is how long the code step stays open: long enough to unlock
	// a phone and read a code, short enough that a leaked ticket is worthless.
	challengeTTL = 5 * time.Minute
	// maxChallengeAttempts burns the ticket after this many wrong codes. The
	// account's own per-role lockout still applies on top of it.
	maxChallengeAttempts = 5
)

var (
	errNoUser           = errors.New("user not found")
	errWrongPassword    = errors.New("incorrect password")
	errTwoFactorEnabled = errors.New("two-factor authentication is already on")
	errTwoFactorOff     = errors.New("two-factor authentication is not on")
	errNoPendingSecret  = errors.New("this setup has expired, start it again")
	errInvalidCode      = errors.New("that code is not valid")
	errChallengeUsed    = errors.New("this sign-in request has expired, sign in again")
)

// twoFactorService owns the secret material: the database rows and the cipher
// that seals the shared secrets at rest.
type twoFactorService struct {
	db    *sql.DB
	crypt *keycrypt.Crypt
}

/* --- stored state --------------------------------------------------------- */

// twoFactorState is one account's 2FA material with the secret already opened.
type twoFactorState struct {
	userID      string
	email       string
	name        string
	role        string
	secret      string // decrypted base32 secret; "" when none is stored
	enabledAt   string // RFC3339; "" when 2FA is off
	lastCounter int64  // last time step that signed in
}

func (s twoFactorState) enabled() bool { return s.enabledAt != "" && s.secret != "" }

func (s *twoFactorService) readState(ctx context.Context, userID string) (twoFactorState, error) {
	state := twoFactorState{userID: userID}
	var (
		secret    sql.NullString
		enabledAt sql.NullString
	)
	err := s.db.QueryRowContext(ctx, `
		SELECT u.email, u.name, r.name, u.totp_secret, u.totp_enabled_at, u.totp_last_counter
		FROM users u JOIN roles r ON r.id = u.role_id
		WHERE u.id = ?`, userID).
		Scan(&state.email, &state.name, &state.role, &secret, &enabledAt, &state.lastCounter)
	if err == sql.ErrNoRows {
		return state, errNoUser
	}
	if err != nil {
		return state, err
	}
	if enabledAt.Valid {
		state.enabledAt = enabledAt.String
	}
	if secret.Valid && secret.String != "" {
		plaintext, err := s.crypt.Decrypt(secret.String)
		if err != nil {
			// A secret that cannot be opened can never verify a code. Treat it
			// as absent so the person can enrol again instead of being locked
			// out of their own account for good.
			plaintext = ""
			state.enabledAt = ""
		}
		state.secret = plaintext
	}
	return state, nil
}

type twoFactorStatusOut struct {
	UserID            string `json:"user_id"`
	Enabled           bool   `json:"enabled"`
	EnabledAt         string `json:"enabled_at,omitempty"`
	Pending           bool   `json:"pending"`
	RecoveryCodesLeft int    `json:"recovery_codes_left"`
}

func (s *twoFactorService) status(ctx context.Context, userID string) (twoFactorStatusOut, error) {
	state, err := s.readState(ctx, userID)
	if err != nil {
		return twoFactorStatusOut{}, err
	}
	left, err := s.recoveryCodesLeft(ctx, userID)
	if err != nil {
		return twoFactorStatusOut{}, err
	}
	return twoFactorStatusOut{
		UserID:            userID,
		Enabled:           state.enabled(),
		EnabledAt:         state.enabledAt,
		Pending:           state.secret != "" && !state.enabled(),
		RecoveryCodesLeft: left,
	}, nil
}

func (s *twoFactorService) recoveryCodesLeft(ctx context.Context, userID string) (int, error) {
	var left int
	err := s.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM user_recovery_codes WHERE user_id = ? AND used_at IS NULL`, userID).Scan(&left)
	return left, err
}

/* --- enrolment ------------------------------------------------------------ */

type twoFactorSetupOut struct {
	UserID     string `json:"user_id"`
	Secret     string `json:"secret"`
	OtpauthURI string `json:"otpauth_uri"`
	Issuer     string `json:"issuer"`
	Account    string `json:"account"`
	Digits     int    `json:"digits"`
	Period     int    `json:"period"`
	Algorithm  string `json:"algorithm"`
}

// startSetup mints a secret and leaves it pending. Nothing changes for the
// account until a code from that secret comes back through enable, so a person
// who walks away mid-setup keeps the account exactly as it was.
func (s *twoFactorService) startSetup(ctx context.Context, userID string) (twoFactorSetupOut, error) {
	state, err := s.readState(ctx, userID)
	if err != nil {
		return twoFactorSetupOut{}, err
	}
	if state.enabled() {
		return twoFactorSetupOut{}, errTwoFactorEnabled
	}

	secret, err := totp.GenerateSecret()
	if err != nil {
		return twoFactorSetupOut{}, err
	}
	sealed, err := s.crypt.Encrypt(secret)
	if err != nil {
		return twoFactorSetupOut{}, err
	}

	// A new secret supersedes anything pending and any codes from an earlier
	// enrolment.
	if _, err := s.db.ExecContext(ctx, `
		UPDATE users SET totp_secret = ?, totp_enabled_at = NULL, totp_last_counter = 0, updated_at = ?
		WHERE id = ?`, sealed, util.Now(), userID); err != nil {
		return twoFactorSetupOut{}, err
	}
	if err := s.dropRecoveryCodes(ctx, userID); err != nil {
		return twoFactorSetupOut{}, err
	}

	return twoFactorSetupOut{
		UserID:     userID,
		Secret:     secret,
		OtpauthURI: totp.URI(twoFactorIssuer, state.email, secret),
		Issuer:     twoFactorIssuer,
		Account:    state.email,
		Digits:     totp.Digits,
		Period:     totp.Period,
		Algorithm:  "SHA1",
	}, nil
}

type twoFactorEnabledOut struct {
	UserID            string   `json:"user_id"`
	Enabled           bool     `json:"enabled"`
	EnabledAt         string   `json:"enabled_at"`
	RecoveryCodes     []string `json:"recovery_codes"`
	RecoveryCodesLeft int      `json:"recovery_codes_left"`
}

// enable confirms the pending secret with a code from the authenticator app,
// then switches 2FA on and hands back the recovery codes. This is the only
// moment those codes exist in readable form.
func (s *twoFactorService) enable(ctx context.Context, userID, code string) (twoFactorEnabledOut, error) {
	state, err := s.readState(ctx, userID)
	if err != nil {
		return twoFactorEnabledOut{}, err
	}
	if state.enabled() {
		return twoFactorEnabledOut{}, errTwoFactorEnabled
	}
	if state.secret == "" {
		return twoFactorEnabledOut{}, errNoPendingSecret
	}

	if _, ok := totp.Verify(state.secret, code, time.Now(), totp.Skew); !ok {
		return twoFactorEnabledOut{}, errInvalidCode
	}

	codes, err := s.mintRecoveryCodes(ctx, userID)
	if err != nil {
		return twoFactorEnabledOut{}, err
	}
	// The confirming code is deliberately not recorded as a used time step:
	// enrolment is not a sign-in, and a person who signs in seconds later is
	// almost certainly still inside that same 30-second window. Earlier
	// accounts cannot replay anything, because last_counter is zeroed.
	enabledAt := util.Now()
	if _, err := s.db.ExecContext(ctx, `
		UPDATE users SET totp_enabled_at = ?, totp_last_counter = 0, updated_at = ?
		WHERE id = ?`, enabledAt, util.Now(), userID); err != nil {
		return twoFactorEnabledOut{}, err
	}

	return twoFactorEnabledOut{
		UserID:            userID,
		Enabled:           true,
		EnabledAt:         enabledAt,
		RecoveryCodes:     codes,
		RecoveryCodesLeft: len(codes),
	}, nil
}

// disable turns 2FA off. A password is required: losing the authenticator is
// exactly the moment somebody else would like to turn this off.
func (s *twoFactorService) disable(ctx context.Context, userID, password string) (twoFactorStatusOut, error) {
	state, err := s.readState(ctx, userID)
	if err != nil {
		return twoFactorStatusOut{}, err
	}
	if !state.enabled() {
		return twoFactorStatusOut{}, errTwoFactorOff
	}
	if err := s.checkPassword(ctx, userID, password); err != nil {
		return twoFactorStatusOut{}, err
	}
	if err := s.clear(ctx, userID); err != nil {
		return twoFactorStatusOut{}, err
	}
	return s.status(ctx, userID)
}

// regenerateRecoveryCodes replaces the batch, for someone who has used most of
// theirs or thinks the printed list was seen by someone else.
func (s *twoFactorService) regenerateRecoveryCodes(ctx context.Context, userID, password string) (twoFactorEnabledOut, error) {
	state, err := s.readState(ctx, userID)
	if err != nil {
		return twoFactorEnabledOut{}, err
	}
	if !state.enabled() {
		return twoFactorEnabledOut{}, errTwoFactorOff
	}
	if err := s.checkPassword(ctx, userID, password); err != nil {
		return twoFactorEnabledOut{}, err
	}
	codes, err := s.mintRecoveryCodes(ctx, userID)
	if err != nil {
		return twoFactorEnabledOut{}, err
	}
	return twoFactorEnabledOut{
		UserID:            userID,
		Enabled:           true,
		EnabledAt:         state.enabledAt,
		RecoveryCodes:     codes,
		RecoveryCodesLeft: len(codes),
	}, nil
}

// reset is the administrator's way back in for somebody who lost both the
// authenticator and the recovery codes. It only removes 2FA; the password stays
// as it was, so the account is no weaker than it was before enrolment.
func (s *twoFactorService) reset(ctx context.Context, userID string) (twoFactorStatusOut, error) {
	if _, err := s.readState(ctx, userID); err != nil {
		return twoFactorStatusOut{}, err
	}
	if err := s.clear(ctx, userID); err != nil {
		return twoFactorStatusOut{}, err
	}
	return s.status(ctx, userID)
}

func (s *twoFactorService) clear(ctx context.Context, userID string) error {
	if _, err := s.db.ExecContext(ctx, `
		UPDATE users SET totp_secret = NULL, totp_enabled_at = NULL, totp_last_counter = 0, updated_at = ?
		WHERE id = ?`, util.Now(), userID); err != nil {
		return err
	}
	return s.dropRecoveryCodes(ctx, userID)
}

func (s *twoFactorService) dropRecoveryCodes(ctx context.Context, userID string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM user_recovery_codes WHERE user_id = ?`, userID)
	return err
}

// mintRecoveryCodes replaces the account's recovery codes and returns the new
// batch in the clear. Only a hash is stored; the plain prefix of each code is
// kept so a sign-in attempt can find the one row to compare against instead of
// hashing the whole batch.
func (s *twoFactorService) mintRecoveryCodes(ctx context.Context, userID string) ([]string, error) {
	codes, err := totp.GenerateRecoveryCodes()
	if err != nil {
		return nil, err
	}
	if err := s.dropRecoveryCodes(ctx, userID); err != nil {
		return nil, err
	}
	now := util.Now()
	for _, code := range codes {
		prefix, ok := totp.RecoveryPrefix(code)
		if !ok {
			return nil, fmt.Errorf("generated recovery code is malformed")
		}
		hash, err := auth.HashPassword(code)
		if err != nil {
			return nil, err
		}
		if _, err := s.db.ExecContext(ctx, `
			INSERT INTO user_recovery_codes (id, user_id, code_prefix, code_hash, created_at)
			VALUES (?, ?, ?, ?, ?)`, util.NewID(), userID, prefix, hash, now); err != nil {
			return nil, err
		}
	}
	return codes, nil
}

func (s *twoFactorService) checkPassword(ctx context.Context, userID, password string) error {
	if strings.TrimSpace(password) == "" {
		return errWrongPassword
	}
	var hash string
	err := s.db.QueryRowContext(ctx, `SELECT password_hash FROM users WHERE id = ?`, userID).Scan(&hash)
	if err == sql.ErrNoRows {
		return errNoUser
	}
	if err != nil {
		return err
	}
	ok, err := auth.VerifyPassword(password, hash)
	if err != nil || !ok {
		return errWrongPassword
	}
	return nil
}

/* --- the sign-in handshake ------------------------------------------------ */

// twoFactorTicket is what the password step hands to the client: an opaque
// token and the moment it stops working.
type twoFactorTicket struct {
	token     string
	expiresAt string
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// issueChallenge mints the short-lived ticket that bridges the password step
// and the code step. Only its hash is stored, so a copy of the database cannot
// be used to finish somebody's sign-in.
func (s *twoFactorService) issueChallenge(ctx context.Context, userID string) (twoFactorTicket, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return twoFactorTicket{}, fmt.Errorf("challenge token: %w", err)
	}
	token := base64.RawURLEncoding.EncodeToString(raw)

	now := time.Now().UTC()
	// Abandoned and expired tickets are dead weight; clear them per account.
	if _, err := s.db.ExecContext(ctx, `
		DELETE FROM two_factor_challenges
		WHERE user_id = ? AND (expires_at < ? OR consumed_at IS NOT NULL)`,
		userID, now.Format(time.RFC3339)); err != nil {
		return twoFactorTicket{}, err
	}

	expiresAt := now.Add(challengeTTL)
	if _, err := s.db.ExecContext(ctx, `
		INSERT INTO two_factor_challenges (id, user_id, token_hash, attempts, expires_at, created_at)
		VALUES (?, ?, ?, 0, ?, ?)`,
		util.NewID(), userID, hashToken(token), expiresAt.Format(time.RFC3339), now.Format(time.RFC3339)); err != nil {
		return twoFactorTicket{}, err
	}
	return twoFactorTicket{token: token, expiresAt: expiresAt.Format(time.RFC3339)}, nil
}

// codeResult carries both sides of a code attempt: the account on success, or
// how many tries are left and whether the attempt locked the account.
type codeResult struct {
	userID       string
	attemptsLeft int
	lockedUntil  string
}

// completeChallenge checks a code (or a recovery code) against the ticket. It
// returns errInvalidCode when the code was wrong but the ticket still stands,
// and errChallengeUsed when the sign-in has to start over.
func (s *twoFactorService) completeChallenge(ctx context.Context, token, code, recoveryCode string) (codeResult, error) {
	result := codeResult{attemptsLeft: -1}
	if strings.TrimSpace(token) == "" {
		return result, errChallengeUsed
	}

	var (
		challengeID string
		userID      string
		expiresAt   string
		attempts    int
		consumedAt  sql.NullString
	)
	err := s.db.QueryRowContext(ctx, `
		SELECT id, user_id, attempts, expires_at, consumed_at
		FROM two_factor_challenges WHERE token_hash = ?`, hashToken(token)).
		Scan(&challengeID, &userID, &attempts, &expiresAt, &consumedAt)
	if err == sql.ErrNoRows {
		return result, errChallengeUsed
	}
	if err != nil {
		return result, err
	}

	now := time.Now().UTC()
	if consumedAt.Valid && consumedAt.String != "" {
		return result, errChallengeUsed
	}
	expiry, err := time.Parse(time.RFC3339, expiresAt)
	if err != nil || !now.Before(expiry) {
		_, _ = s.db.ExecContext(ctx, `DELETE FROM two_factor_challenges WHERE id = ?`, challengeID)
		return result, errChallengeUsed
	}
	if attempts >= maxChallengeAttempts {
		_, _ = s.db.ExecContext(ctx, `DELETE FROM two_factor_challenges WHERE id = ?`, challengeID)
		return result, errChallengeUsed
	}

	state, err := s.readState(ctx, userID)
	if err != nil {
		return result, err
	}
	if !state.enabled() {
		// 2FA was turned off while this ticket was open. The password was
		// already correct, so finish the sign-in the ordinary way.
		if err := s.burnChallenge(ctx, challengeID); err != nil {
			return result, err
		}
		result.userID = userID
		return result, nil
	}

	accepted := false
	switch {
	case strings.TrimSpace(code) != "":
		counter, ok := totp.Verify(state.secret, code, now, totp.Skew)
		// A time step that already signed in is refused, so a code glimpsed
		// over a shoulder cannot be used a second time inside its window.
		if ok && int64(counter) > state.lastCounter {
			if _, err := s.db.ExecContext(ctx,
				`UPDATE users SET totp_last_counter = ?, updated_at = ? WHERE id = ?`,
				int64(counter), util.Now(), userID); err != nil {
				return result, err
			}
			accepted = true
		}
	case strings.TrimSpace(recoveryCode) != "":
		accepted, err = s.consumeRecoveryCode(ctx, userID, recoveryCode)
		if err != nil {
			return result, err
		}
	}

	if accepted {
		if err := s.burnChallenge(ctx, challengeID); err != nil {
			return result, err
		}
		if err := clearFailedAttempts(ctx, s.db, userID); err != nil {
			return result, err
		}
		result.userID = userID
		return result, nil
	}

	// A wrong code is a wrong credential: it costs a ticket attempt and counts
	// against the account, so guessing codes is as expensive as guessing the
	// password.
	if _, err := s.db.ExecContext(ctx,
		`UPDATE two_factor_challenges SET attempts = attempts + 1 WHERE id = ?`, challengeID); err != nil {
		return result, err
	}
	var policy loginPolicy
	err = s.db.QueryRowContext(ctx, `
		SELECT u.failed_login_attempts, u.locked_until, r.max_login_attempts, r.lock_minutes
		FROM users u JOIN roles r ON r.id = u.role_id
		WHERE u.id = ?`, userID).
		Scan(&policy.failed, &policy.lockedUntil, &policy.maxAttempts, &policy.lockMinutes)
	if err != nil {
		return result, err
	}
	result.attemptsLeft, result.lockedUntil, err = recordFailedAttempt(ctx, s.db, userID, policy)
	if err != nil {
		return result, err
	}
	// Whichever budget runs out first is the one that matters: the ticket's
	// attempts or the account's lockout.
	ticketLeft := maxChallengeAttempts - (attempts + 1)
	if result.attemptsLeft < 0 || ticketLeft < result.attemptsLeft {
		result.attemptsLeft = ticketLeft
	}
	return result, errInvalidCode
}

// consumeRecoveryCode burns one recovery code. Codes are single use: the row
// keeps used_at, so a used code never works again and the count stays honest.
func (s *twoFactorService) consumeRecoveryCode(ctx context.Context, userID, code string) (bool, error) {
	prefix, ok := totp.RecoveryPrefix(code)
	if !ok {
		return false, nil
	}
	normalized := totp.NormalizeRecoveryCode(code)

	rows, err := s.db.QueryContext(ctx, `
		SELECT id, code_hash FROM user_recovery_codes
		WHERE user_id = ? AND code_prefix = ? AND used_at IS NULL`, userID, prefix)
	if err != nil {
		return false, err
	}
	defer rows.Close()

	type candidate struct{ id, hash string }
	found := []candidate{}
	for rows.Next() {
		var c candidate
		if err := rows.Scan(&c.id, &c.hash); err != nil {
			return false, err
		}
		found = append(found, c)
	}
	if err := rows.Err(); err != nil {
		return false, err
	}

	for _, c := range found {
		valid, err := auth.VerifyPassword(normalized, c.hash)
		if err != nil || !valid {
			continue
		}
		if _, err := s.db.ExecContext(ctx,
			`UPDATE user_recovery_codes SET used_at = ? WHERE id = ?`, util.Now(), c.id); err != nil {
			return false, err
		}
		return true, nil
	}
	return false, nil
}

func (s *twoFactorService) burnChallenge(ctx context.Context, challengeID string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM two_factor_challenges WHERE id = ?`, challengeID)
	return err
}

/* --- HTTP ----------------------------------------------------------------- */

// twoFactorManageRequest is the body of the self-service endpoints: the caller
// is the account being changed, so there is no user id in here — the session
// decides. A password is re-checked where an operation weakens the account.
type twoFactorManageRequest struct {
	Code     string `json:"code"`
	Password string `json:"password"`
}

type loginTwoFactorRequest struct {
	Challenge    string `json:"challenge"`
	Code         string `json:"code"`
	RecoveryCode string `json:"recovery_code"`
}

func writeTwoFactorError(w http.ResponseWriter, err error) {
	status := http.StatusInternalServerError
	switch {
	case errors.Is(err, errNoUser):
		status = http.StatusNotFound
	case errors.Is(err, errWrongPassword), errors.Is(err, errChallengeUsed):
		status = http.StatusUnauthorized
	case errors.Is(err, errTwoFactorEnabled),
		errors.Is(err, errTwoFactorOff),
		errors.Is(err, errNoPendingSecret),
		errors.Is(err, errInvalidCode):
		status = http.StatusBadRequest
	}
	writeJSON(w, status, map[string]string{"error": err.Error()})
}

func registerTwoFactor(mux *http.ServeMux, service *twoFactorService, sessions *sessionStore) {
	// GET /api/me/two-factor — what the settings card renders.
	mux.HandleFunc("GET /api/me/two-factor", func(w http.ResponseWriter, r *http.Request) {
		status, err := service.status(r.Context(), callerFrom(r).ID)
		if err != nil {
			writeTwoFactorError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, status)
	})

	// POST /api/me/two-factor/setup — mint a pending secret plus its otpauth URI.
	mux.HandleFunc("POST /api/me/two-factor/setup", func(w http.ResponseWriter, r *http.Request) {
		setup, err := service.startSetup(r.Context(), callerFrom(r).ID)
		if err != nil {
			writeTwoFactorError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, setup)
	})

	// POST /api/me/two-factor/enable — confirm the secret with a first code.
	mux.HandleFunc("POST /api/me/two-factor/enable", func(w http.ResponseWriter, r *http.Request) {
		var req twoFactorManageRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		enabled, err := service.enable(r.Context(), callerFrom(r).ID, req.Code)
		if err != nil {
			writeTwoFactorError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, enabled)
	})

	// POST /api/me/two-factor/disable — password required, then 2FA comes off.
	mux.HandleFunc("POST /api/me/two-factor/disable", func(w http.ResponseWriter, r *http.Request) {
		var req twoFactorManageRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		status, err := service.disable(r.Context(), callerFrom(r).ID, req.Password)
		if err != nil {
			writeTwoFactorError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, status)
	})

	// POST /api/me/two-factor/recovery-codes — replace the printed batch.
	mux.HandleFunc("POST /api/me/two-factor/recovery-codes", func(w http.ResponseWriter, r *http.Request) {
		var req twoFactorManageRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		enabled, err := service.regenerateRecoveryCodes(r.Context(), callerFrom(r).ID, req.Password)
		if err != nil {
			writeTwoFactorError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, enabled)
	})

	// POST /api/auth/login/2fa — second step of a sign-in: ticket + code. The
	// ticket, not the caller, names the account; a real session is what comes
	// back, exactly as the password step hands one out.
	mux.HandleFunc("POST /api/auth/login/2fa", func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		var req loginTwoFactorRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		if strings.TrimSpace(req.Code) == "" && strings.TrimSpace(req.RecoveryCode) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "enter the code from your authenticator app"})
			return
		}

		result, err := service.completeChallenge(ctx, req.Challenge, req.Code, req.RecoveryCode)
		switch {
		case errors.Is(err, errChallengeUsed):
			writeTwoFactorError(w, err)
			return
		case errors.Is(err, errInvalidCode):
			body := map[string]any{"error": errInvalidCode.Error()}
			if result.attemptsLeft >= 0 {
				body["attempts_left"] = result.attemptsLeft
			}
			if result.lockedUntil != "" {
				body["error"] = "account locked due to too many failed attempts"
				body["locked_until"] = result.lockedUntil
				writeJSON(w, http.StatusLocked, body)
				return
			}
			writeJSON(w, http.StatusUnauthorized, body)
			return
		case err != nil:
			writeTwoFactorError(w, err)
			return
		}

		payload, err := issueSessionFor(w, r, sessions, result.userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	// POST /api/users/{userID}/two-factor/reset — an administrator unlocking an
	// account whose owner lost both the app and the recovery codes. The path id
	// is the target; the caller is the administrator, and the route policy is
	// what keeps this admin-only.
	mux.HandleFunc("POST /api/users/{userID}/two-factor/reset", func(w http.ResponseWriter, r *http.Request) {
		userID := r.PathValue("userID")
		status, err := service.reset(r.Context(), userID)
		if err != nil {
			writeTwoFactorError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, status)
	})
}
