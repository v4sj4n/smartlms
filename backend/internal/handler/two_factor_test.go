package handler

import (
	"context"
	"database/sql"
	"errors"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"optimolms/backend/internal/auth"
	"optimolms/backend/internal/db"
	"optimolms/backend/internal/keycrypt"
	"optimolms/backend/internal/totp"
	"optimolms/backend/internal/util"
)

// testService builds a two-factor service over a throwaway database holding one
// student account, so the tests exercise the real SQL and the real cipher.
func testService(t *testing.T) (*twoFactorService, string) {
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

	roleID, userID := util.NewID(), util.NewID()
	now := util.Now()
	// Five tries, then a fifteen minute lock: the same shape the seed gives
	// STUDENT, so the lockout paths are exercised for real.
	if _, err := database.ExecContext(ctx,
		`INSERT INTO roles (id, name, max_login_attempts, lock_minutes) VALUES (?, 'STUDENT', 5, 15)`,
		roleID); err != nil {
		t.Fatalf("insert role: %v", err)
	}
	hash, err := auth.HashPassword("student123")
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}
	if _, err := database.ExecContext(ctx, `
		INSERT INTO users (id, email, password_hash, name, role_id, created_at, updated_at)
		VALUES (?, 'student@school.edu', ?, 'Student User', ?, ?, ?)`,
		userID, hash, roleID, now, now); err != nil {
		t.Fatalf("insert user: %v", err)
	}

	crypt, err := keycrypt.NewLabeled("test-encryption-secret", "user-totp-secret")
	if err != nil {
		t.Fatalf("cipher: %v", err)
	}
	return &twoFactorService{db: database, crypt: crypt}, userID
}

func TestStatusStartsOff(t *testing.T) {
	service, userID := testService(t)
	status, err := service.status(context.Background(), userID)
	if err != nil {
		t.Fatalf("status: %v", err)
	}
	if status.Enabled || status.Pending || status.RecoveryCodesLeft != 0 {
		t.Fatalf("a new account should have no two-factor material: %+v", status)
	}
}

func TestSetupLeavesTheAccountUnchangedUntilConfirmed(t *testing.T) {
	service, userID := testService(t)
	ctx := context.Background()

	setup, err := service.startSetup(ctx, userID)
	if err != nil {
		t.Fatalf("setup: %v", err)
	}
	if setup.Secret == "" || !strings.HasPrefix(setup.OtpauthURI, "otpauth://totp/") {
		t.Fatalf("setup should return a secret and a URI: %+v", setup)
	}
	if !strings.Contains(setup.OtpauthURI, "student%40school.edu") &&
		!strings.Contains(setup.OtpauthURI, "student@school.edu") {
		t.Errorf("the URI should name the account: %s", setup.OtpauthURI)
	}

	status, err := service.status(ctx, userID)
	if err != nil {
		t.Fatalf("status: %v", err)
	}
	if status.Enabled {
		t.Error("a pending secret must not count as enabled")
	}
	if !status.Pending {
		t.Error("a minted secret should read back as pending")
	}

	// The secret is sealed at rest: the plaintext must not be in the column.
	var stored string
	if err := service.db.QueryRowContext(ctx, `SELECT totp_secret FROM users WHERE id = ?`, userID).Scan(&stored); err != nil {
		t.Fatalf("read secret: %v", err)
	}
	if stored == setup.Secret || strings.Contains(stored, setup.Secret) {
		t.Error("the secret should be encrypted in the database")
	}
}

func TestEnableThenSignInWithACode(t *testing.T) {
	service, userID := testService(t)
	ctx := context.Background()

	setup, err := service.startSetup(ctx, userID)
	if err != nil {
		t.Fatalf("setup: %v", err)
	}
	if _, err := service.enable(ctx, userID, "000000"); !errors.Is(err, errInvalidCode) {
		t.Fatalf("a wrong first code must not enable 2FA, got %v", err)
	}

	code, err := totp.Code(setup.Secret, time.Now())
	if err != nil {
		t.Fatalf("code: %v", err)
	}
	enabled, err := service.enable(ctx, userID, code)
	if err != nil {
		t.Fatalf("enable: %v", err)
	}
	if !enabled.Enabled || enabled.EnabledAt == "" {
		t.Fatalf("enable should switch 2FA on: %+v", enabled)
	}
	if len(enabled.RecoveryCodes) != totp.RecoveryCodeCount {
		t.Fatalf("got %d recovery codes, want %d", len(enabled.RecoveryCodes), totp.RecoveryCodeCount)
	}

	// Signing in immediately after enrolment must work even though the code is
	// still inside the same 30-second window the enrolment used.
	ticket, err := service.issueChallenge(ctx, userID)
	if err != nil {
		t.Fatalf("challenge: %v", err)
	}
	result, err := service.completeChallenge(ctx, ticket.token, code, "")
	if err != nil {
		t.Fatalf("first sign-in after enrolment should pass: %v", err)
	}
	if result.userID != userID {
		t.Fatalf("completed challenge should name the account, got %q", result.userID)
	}

	// The same code on a fresh ticket is a replay and must be refused.
	ticket, err = service.issueChallenge(ctx, userID)
	if err != nil {
		t.Fatalf("challenge: %v", err)
	}
	if _, err := service.completeChallenge(ctx, ticket.token, code, ""); !errors.Is(err, errInvalidCode) {
		t.Fatalf("a replayed code should be refused, got %v", err)
	}

	// The next window's code works.
	next, err := totp.Code(setup.Secret, time.Now().Add(totp.Period*time.Second))
	if err != nil {
		t.Fatalf("code: %v", err)
	}
	ticket, err = service.issueChallenge(ctx, userID)
	if err != nil {
		t.Fatalf("challenge: %v", err)
	}
	if _, err := service.completeChallenge(ctx, ticket.token, next, ""); err != nil {
		t.Fatalf("the next window's code should pass: %v", err)
	}
}

func TestTicketIsSingleUseAndExpires(t *testing.T) {
	service, userID := testService(t)
	ctx := context.Background()
	secret, code, ticket := enrol(t, service, userID)

	if _, err := service.completeChallenge(ctx, ticket.token, code, ""); err != nil {
		t.Fatalf("sign-in: %v", err)
	}
	// The same ticket again: it was burned by the successful sign-in.
	if _, err := service.completeChallenge(ctx, ticket.token, code, ""); !errors.Is(err, errChallengeUsed) {
		t.Fatalf("a used ticket should be dead, got %v", err)
	}

	// An expired ticket is dead too.
	stale, err := service.issueChallenge(ctx, userID)
	if err != nil {
		t.Fatalf("challenge: %v", err)
	}
	if _, err := service.db.ExecContext(ctx,
		`UPDATE two_factor_challenges SET expires_at = ? WHERE token_hash = ?`,
		time.Now().UTC().Add(-time.Minute).Format(time.RFC3339), hashToken(stale.token)); err != nil {
		t.Fatalf("age the ticket: %v", err)
	}
	fresh, err := totp.Code(secret, time.Now().Add(2*totp.Period*time.Second))
	if err != nil {
		t.Fatalf("code: %v", err)
	}
	if _, err := service.completeChallenge(ctx, stale.token, fresh, ""); !errors.Is(err, errChallengeUsed) {
		t.Fatalf("an expired ticket should be dead, got %v", err)
	}
}

func TestWrongCodesBurnTheTicketAndLockTheAccount(t *testing.T) {
	service, userID := testService(t)
	_, _, ticket := enrol(t, service, userID)
	ctx := context.Background()

	lockedUntil := ""
	for attempt := 1; attempt <= maxChallengeAttempts; attempt++ {
		result, err := service.completeChallenge(ctx, ticket.token, "000000", "")
		if !errors.Is(err, errInvalidCode) {
			t.Fatalf("attempt %d: want errInvalidCode, got %v", attempt, err)
		}
		if result.attemptsLeft != maxChallengeAttempts-attempt {
			t.Errorf("attempt %d: attemptsLeft = %d, want %d",
				attempt, result.attemptsLeft, maxChallengeAttempts-attempt)
		}
		if result.lockedUntil != "" {
			lockedUntil = result.lockedUntil
		}
	}
	// The role allows five failures, so the fifth one locks the account.
	if lockedUntil == "" {
		t.Fatal("the last wrong code should have locked the account")
	}
	if _, err := service.completeChallenge(ctx, ticket.token, "000000", ""); !errors.Is(err, errChallengeUsed) {
		t.Fatalf("the ticket should be burned by now, got %v", err)
	}
}

func TestRecoveryCodeSignsInOnce(t *testing.T) {
	service, userID := testService(t)
	ctx := context.Background()
	_, _, _ = enrol(t, service, userID)

	// The codes are only readable at mint time, so mint a fresh batch and use
	// one of those.
	codes, err := service.mintRecoveryCodes(ctx, userID)
	if err != nil {
		t.Fatalf("mint: %v", err)
	}
	if left, err := service.recoveryCodesLeft(ctx, userID); err != nil || left != len(codes) {
		t.Fatalf("codes left = %d, err = %v", left, err)
	}

	ticket, err := service.issueChallenge(ctx, userID)
	if err != nil {
		t.Fatalf("challenge: %v", err)
	}
	if _, err := service.completeChallenge(ctx, ticket.token, "", codes[0]); err != nil {
		t.Fatalf("a recovery code should sign in: %v", err)
	}
	if left, _ := service.recoveryCodesLeft(ctx, userID); left != len(codes)-1 {
		t.Errorf("codes left = %d, want %d", left, len(codes)-1)
	}

	ticket, err = service.issueChallenge(ctx, userID)
	if err != nil {
		t.Fatalf("challenge: %v", err)
	}
	if _, err := service.completeChallenge(ctx, ticket.token, "", codes[0]); !errors.Is(err, errInvalidCode) {
		t.Fatalf("a spent recovery code must not work twice, got %v", err)
	}

	// A code that is not in the batch is refused.
	ticket, err = service.issueChallenge(ctx, userID)
	if err != nil {
		t.Fatalf("challenge: %v", err)
	}
	if _, err := service.completeChallenge(ctx, ticket.token, "", "ZZZZZ-ZZZZZ"); !errors.Is(err, errInvalidCode) {
		t.Fatalf("an unknown recovery code should be refused, got %v", err)
	}
}

func TestDisableAndRegenerateNeedThePassword(t *testing.T) {
	service, userID := testService(t)
	ctx := context.Background()
	enrol(t, service, userID)

	if _, err := service.disable(ctx, userID, "not-the-password"); !errors.Is(err, errWrongPassword) {
		t.Fatalf("disable with a wrong password should be refused, got %v", err)
	}
	if _, err := service.regenerateRecoveryCodes(ctx, userID, "not-the-password"); !errors.Is(err, errWrongPassword) {
		t.Fatalf("regenerating with a wrong password should be refused, got %v", err)
	}

	status, err := service.disable(ctx, userID, "student123")
	if err != nil {
		t.Fatalf("disable: %v", err)
	}
	if status.Enabled || status.RecoveryCodesLeft != 0 {
		t.Fatalf("disabling should remove all material: %+v", status)
	}
	var stored sql.NullString
	if err := service.db.QueryRowContext(ctx, `SELECT totp_secret FROM users WHERE id = ?`, userID).Scan(&stored); err != nil {
		t.Fatalf("read secret: %v", err)
	}
	if stored.Valid && stored.String != "" {
		t.Error("disabling should clear the stored secret")
	}
	if _, err := service.disable(ctx, userID, "student123"); !errors.Is(err, errTwoFactorOff) {
		t.Fatalf("disabling twice should say 2FA is off, got %v", err)
	}
}

func TestResetClearsEnrolmentWithoutThePassword(t *testing.T) {
	service, userID := testService(t)
	ctx := context.Background()
	enrol(t, service, userID)

	status, err := service.reset(ctx, userID)
	if err != nil {
		t.Fatalf("reset: %v", err)
	}
	if status.Enabled || status.Pending {
		t.Fatalf("reset should leave the account without 2FA: %+v", status)
	}

	// The password is untouched, so a normal sign-in still works afterwards.
	if err := service.checkPassword(ctx, userID, "student123"); err != nil {
		t.Errorf("reset must not disturb the password: %v", err)
	}
}

func TestSetupRefusesWhenAlreadyEnabled(t *testing.T) {
	service, userID := testService(t)
	enrol(t, service, userID)
	if _, err := service.startSetup(context.Background(), userID); !errors.Is(err, errTwoFactorEnabled) {
		t.Fatalf("re-running setup over an enabled account should conflict, got %v", err)
	}
}

// enrol turns 2FA on for the test account and returns the secret, the code that
// confirmed it and a fresh challenge ticket.
func enrol(t *testing.T, service *twoFactorService, userID string) (secret, code string, ticket twoFactorTicket) {
	t.Helper()
	ctx := context.Background()
	setup, err := service.startSetup(ctx, userID)
	if err != nil {
		t.Fatalf("setup: %v", err)
	}
	code, err = totp.Code(setup.Secret, time.Now())
	if err != nil {
		t.Fatalf("code: %v", err)
	}
	if _, err := service.enable(ctx, userID, code); err != nil {
		t.Fatalf("enable: %v", err)
	}
	ticket, err = service.issueChallenge(ctx, userID)
	if err != nil {
		t.Fatalf("challenge: %v", err)
	}
	return setup.Secret, code, ticket
}
