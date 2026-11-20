// Package totp implements the time-based one-time passwords of RFC 6238 that
// back two-factor sign-in, plus the recovery codes that stand in for them when
// the authenticator app is gone. It is standard library only: a code has to be
// checked on the login path, and that path should not pull a dependency in.
package totp

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"crypto/subtle"
	"encoding/base32"
	"encoding/binary"
	"fmt"
	"io"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	// Digits is the code length. Every authenticator app supports six.
	Digits = 6
	// Period is how many seconds a code stays valid (RFC 6238 default).
	Period = 30
	// SecretSize is the shared secret length in bytes (RFC 4226 §4 asks for
	// 160 bits).
	SecretSize = 20
	// Skew is how many periods either side of now are accepted, so a phone
	// whose clock drifts by a few seconds still signs in. One period covers
	// a slow typist without widening the window much.
	Skew = 1
	// RecoveryCodeLength is the length of one recovery code in characters.
	// Ten characters from a 32-symbol alphabet is 50 bits of entropy, which is
	// far more than a code the server rate-limits needs.
	RecoveryCodeLength = 10
	// RecoveryCodeCount is how many codes are minted when two-factor is turned
	// on: enough to survive losing a phone twice, few enough to print.
	RecoveryCodeCount = 10
)

// recoveryAlphabet leaves out I, O, 0 and 1: the codes get read off paper and
// typed by hand, so the characters people confuse must not exist.
const recoveryAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

// encoding is the unpadded uppercase base32 that authenticator apps expect.
var encoding = base32.StdEncoding.WithPadding(base32.NoPadding)

// GenerateSecret returns a new random secret, base32 encoded and ready to be
// put in an otpauth:// URI.
func GenerateSecret() (string, error) {
	raw := make([]byte, SecretSize)
	if _, err := rand.Read(raw); err != nil {
		return "", fmt.Errorf("generate secret: %w", err)
	}
	return encoding.EncodeToString(raw), nil
}

// SecretBytes decodes a base32 secret, upper-casing it first so a secret typed
// by hand in lower case still works.
func SecretBytes(secret string) ([]byte, error) {
	trimmed := strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(secret), " ", ""))
	if trimmed == "" {
		return nil, fmt.Errorf("empty secret")
	}
	raw, err := encoding.DecodeString(trimmed)
	if err != nil {
		return nil, fmt.Errorf("decode secret: %w", err)
	}
	if len(raw) < 10 {
		return nil, fmt.Errorf("secret is too short")
	}
	return raw, nil
}

// Counter is the RFC 6238 time step that contains at.
func Counter(at time.Time) uint64 {
	seconds := at.UTC().Unix()
	if seconds < 0 {
		return 0
	}
	return uint64(seconds) / Period
}

// CodeAtCounter returns the code for one time step. Exported for tests and for
// the setup screen, which shows the current code as a sanity check.
func CodeAtCounter(secret string, counter uint64) (string, error) {
	key, err := SecretBytes(secret)
	if err != nil {
		return "", err
	}
	var message [8]byte
	binary.BigEndian.PutUint64(message[:], counter)

	mac := hmac.New(sha1.New, key)
	mac.Write(message[:])
	sum := mac.Sum(nil)

	// Dynamic truncation, RFC 4226 §5.3: the low nibble of the last byte says
	// which four bytes carry the value, and the top bit is dropped.
	offset := sum[len(sum)-1] & 0x0f
	value := binary.BigEndian.Uint32(sum[offset:offset+4]) & 0x7fffffff
	return fmt.Sprintf("%0*d", Digits, value%1_000_000), nil
}

// Code returns the code valid at at.
func Code(secret string, at time.Time) (string, error) {
	return CodeAtCounter(secret, Counter(at))
}

// Verify checks code against secret, accepting the steps within skew of at. It
// returns the time step that matched so the caller can refuse to accept a step
// it has already used, which is what stops a captured code from being replayed
// within its half-minute window.
func Verify(secret, code string, at time.Time, skew int) (uint64, bool) {
	normalized := NormalizeCode(code)
	if len(normalized) != Digits {
		return 0, false
	}
	current := int64(Counter(at))
	for offset := -int64(skew); offset <= int64(skew); offset++ {
		counter := current + offset
		if counter < 0 {
			continue
		}
		want, err := CodeAtCounter(secret, uint64(counter))
		if err != nil {
			return 0, false
		}
		if subtle.ConstantTimeCompare([]byte(want), []byte(normalized)) == 1 {
			return uint64(counter), true
		}
	}
	return 0, false
}

// NormalizeCode strips whatever spacing people and autofill add, so "123 456"
// and "123-456" both check as "123456".
func NormalizeCode(raw string) string {
	var builder strings.Builder
	builder.Grow(len(raw))
	for _, r := range raw {
		if r >= '0' && r <= '9' {
			builder.WriteRune(r)
		}
	}
	return builder.String()
}

// URI builds the otpauth:// URI an authenticator app imports, either by
// scanning the QR code drawn from it or by pasting it in.
func URI(issuer, account, secret string) string {
	label := url.PathEscape(issuer + ":" + account)
	params := url.Values{}
	params.Set("secret", secret)
	params.Set("issuer", issuer)
	params.Set("algorithm", "SHA1")
	params.Set("digits", strconv.Itoa(Digits))
	params.Set("period", strconv.Itoa(Period))
	return "otpauth://totp/" + label + "?" + params.Encode()
}

// GenerateRecoveryCode returns one printed recovery code, uppercase and without
// grouping. FormatRecoveryCode adds the separator for display.
func GenerateRecoveryCode() (string, error) {
	return generateRecoveryCode(rand.Reader)
}

// generateRecoveryCode is the seam the tests use to make the random source
// deterministic; it maps bytes onto the alphabet without modulo bias by
// rejecting the tail that does not divide evenly.
func generateRecoveryCode(source io.Reader) (string, error) {
	// 256 / 32 divides evenly, so masking to five bits is unbiased.
	buf := make([]byte, RecoveryCodeLength)
	if _, err := source.Read(buf); err != nil {
		return "", fmt.Errorf("generate recovery code: %w", err)
	}
	out := make([]byte, RecoveryCodeLength)
	for i, b := range buf {
		out[i] = recoveryAlphabet[b&0x1f]
	}
	return string(out), nil
}

// GenerateRecoveryCodes returns a fresh batch of distinct codes.
func GenerateRecoveryCodes() ([]string, error) {
	codes := make([]string, 0, RecoveryCodeCount)
	seen := make(map[string]bool, RecoveryCodeCount)
	for len(codes) < RecoveryCodeCount {
		code, err := GenerateRecoveryCode()
		if err != nil {
			return nil, err
		}
		if seen[code] {
			continue
		}
		seen[code] = true
		codes = append(codes, code)
	}
	return codes, nil
}

// FormatRecoveryCode renders a stored code the way it is printed, split in two
// halves so it can be read back without losing your place.
func FormatRecoveryCode(code string) string {
	normalized := NormalizeRecoveryCode(code)
	if len(normalized) != RecoveryCodeLength {
		return normalized
	}
	return normalized[:5] + "-" + normalized[5:]
}

// NormalizeRecoveryCode upper-cases a recovery code and drops the separator, so
// "abcde-fghjk" and "ABCDE FGHJK" compare equal.
func NormalizeRecoveryCode(raw string) string {
	var builder strings.Builder
	builder.Grow(len(raw))
	for _, r := range strings.ToUpper(raw) {
		if strings.ContainsRune(recoveryAlphabet, r) {
			builder.WriteRune(r)
		}
	}
	return builder.String()
}

// RecoveryPrefix is the part of a code stored in the clear so a lookup can find
// the one hash to compare against instead of hashing every stored code.
func RecoveryPrefix(code string) (string, bool) {
	normalized := NormalizeRecoveryCode(code)
	if len(normalized) != RecoveryCodeLength {
		return "", false
	}
	return normalized[:5], true
}

// ValidRecoveryCode reports whether code looks like a recovery code at all.
func ValidRecoveryCode(code string) bool {
	_, ok := RecoveryPrefix(code)
	return ok
}
