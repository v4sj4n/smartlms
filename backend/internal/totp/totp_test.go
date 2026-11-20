package totp

import (
	"bytes"
	"strings"
	"testing"
	"time"
)

// rfcSecret is the shared secret from RFC 6238 appendix B: the ASCII string
// "12345678901234567890", base32 encoded the way an app would carry it.
const rfcSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"

func TestCodeMatchesRFC6238Vectors(t *testing.T) {
	// The RFC publishes SHA-1 codes truncated to eight digits; our six-digit
	// codes are the same values modulo the extra two digits, so the last six
	// characters must line up exactly.
	vectors := []struct {
		unix int64
		want string
	}{
		{59, "287082"},          // 94287082
		{1111111109, "081804"},  // 07081804
		{1111111111, "050471"},  // 14050471
		{1234567890, "005924"},  // 89005924
		{2000000000, "279037"},  // 69279037
		{20000000000, "353130"}, // 65353130
	}
	for _, vector := range vectors {
		got, err := Code(rfcSecret, time.Unix(vector.unix, 0))
		if err != nil {
			t.Fatalf("code at %d: %v", vector.unix, err)
		}
		if got != vector.want {
			t.Errorf("code at %d = %s, want %s", vector.unix, got, vector.want)
		}
	}
}

func TestCounterBucketsByPeriod(t *testing.T) {
	// An aligned instant: 1_700_000_010 divides evenly by the 30s period.
	start := time.Unix(1_700_000_010, 0)
	bucket := Counter(start)
	if Counter(start.Add(Period*time.Second-1)) != bucket {
		t.Error("the last second of a period belongs to that period")
	}
	if Counter(start.Add(Period*time.Second)) != bucket+1 {
		t.Error("the next period should advance the counter by one")
	}
	// Period boundaries are absolute, not relative to when the secret was made.
	if Counter(time.Unix(0, 0)) != 0 {
		t.Error("the epoch is counter zero")
	}
}

func TestVerifyAcceptsOneStepOfDriftAndRejectsMore(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)

	drifted, err := Code(rfcSecret, now.Add(Period*time.Second))
	if err != nil {
		t.Fatalf("code: %v", err)
	}
	if _, ok := Verify(rfcSecret, drifted, now, Skew); !ok {
		t.Error("a code one step ahead should be accepted")
	}

	far, err := Code(rfcSecret, now.Add(3*Period*time.Second))
	if err != nil {
		t.Fatalf("code: %v", err)
	}
	if _, ok := Verify(rfcSecret, far, now, Skew); ok {
		t.Error("a code three steps ahead should be rejected")
	}
}

func TestVerifyReturnsTheMatchedStep(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	code, err := Code(rfcSecret, now)
	if err != nil {
		t.Fatalf("code: %v", err)
	}
	step, ok := Verify(rfcSecret, code, now, Skew)
	if !ok {
		t.Fatal("the current code should verify")
	}
	if step != Counter(now) {
		t.Errorf("step = %d, want %d", step, Counter(now))
	}
}

func TestVerifyRejectsGarbage(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	cases := []string{"", "12345", "1234567", "abcdef", "not a code"}
	for _, code := range cases {
		if _, ok := Verify(rfcSecret, code, now, Skew); ok {
			t.Errorf("code %q should not verify", code)
		}
	}
	if _, ok := Verify("not-base32!!", "123456", now, Skew); ok {
		t.Error("a malformed secret should never verify")
	}
}

func TestNormalizeCodeStripsSeparators(t *testing.T) {
	for _, raw := range []string{"123 456", "123-456", " 123456 ", "123.456"} {
		if got := NormalizeCode(raw); got != "123456" {
			t.Errorf("NormalizeCode(%q) = %q", raw, got)
		}
	}
}

func TestGenerateSecretIsUsableAndRandom(t *testing.T) {
	first, err := GenerateSecret()
	if err != nil {
		t.Fatalf("secret: %v", err)
	}
	second, err := GenerateSecret()
	if err != nil {
		t.Fatalf("secret: %v", err)
	}
	if first == second {
		t.Fatal("two secrets should never come out the same")
	}
	if strings.ContainsAny(first, "=abcdefghijklmnopqrstuvwxyz") {
		t.Errorf("secret %q should be unpadded uppercase base32", first)
	}
	if _, err := SecretBytes(first); err != nil {
		t.Errorf("a generated secret should decode: %v", err)
	}
	// Lower case and stray spaces still decode: people retype secrets.
	if _, err := SecretBytes(strings.ToLower(" " + first + " ")); err != nil {
		t.Errorf("secret should decode case-insensitively: %v", err)
	}
}

func TestURICarriesWhatAppsExpect(t *testing.T) {
	uri := URI("OptimoLMS", "student@school.edu", rfcSecret)
	if !strings.HasPrefix(uri, "otpauth://totp/") {
		t.Fatalf("uri = %q", uri)
	}
	if !strings.Contains(uri, "/OptimoLMS:student@school.edu?") {
		t.Errorf("uri label should be Issuer:account: %s", uri)
	}
	for _, want := range []string{
		// The key URI format keeps the label human-readable; ':' and '@' are
		// legal in a path segment and every authenticator app parses them.
		"secret=" + rfcSecret,
		"issuer=OptimoLMS",
		"algorithm=SHA1",
		"digits=6",
		"period=30",
	} {
		if !strings.Contains(uri, want) {
			t.Errorf("uri is missing %q: %s", want, uri)
		}
	}
}

func TestRecoveryCodeShapeAndNormalization(t *testing.T) {
	code, err := generateRecoveryCode(bytes.NewReader(bytes.Repeat([]byte{0x00}, RecoveryCodeLength)))
	if err != nil {
		t.Fatalf("recovery code: %v", err)
	}
	if len(code) != RecoveryCodeLength {
		t.Fatalf("length = %d, want %d", len(code), RecoveryCodeLength)
	}
	if code != "AAAAAAAAAA" {
		t.Errorf("all-zero bytes should map to the first symbol, got %q", code)
	}
	if strings.ContainsAny(code, "IO01") {
		t.Errorf("code %q should avoid lookalike characters", code)
	}

	formatted := FormatRecoveryCode("abcdeFGHJK")
	if formatted != "ABCDE-FGHJK" {
		t.Errorf("FormatRecoveryCode = %q", formatted)
	}
	for _, raw := range []string{"ABCDE-FGHJK", "abcde fghjk", "abcdeFGHJK"} {
		if got := NormalizeRecoveryCode(raw); got != "ABCDEFGHJK" {
			t.Errorf("NormalizeRecoveryCode(%q) = %q", raw, got)
		}
	}
	if prefix, ok := RecoveryPrefix("abcde-fghjk"); !ok || prefix != "ABCDE" {
		t.Errorf("RecoveryPrefix = %q, %v", prefix, ok)
	}
	if _, ok := RecoveryPrefix("too-short"); ok {
		t.Error("a short code is not a recovery code")
	}
	if !ValidRecoveryCode("ABCDE-FGHJK") || ValidRecoveryCode("nope") {
		t.Error("ValidRecoveryCode should follow the length rule")
	}
}

func TestGenerateRecoveryCodesAreUnique(t *testing.T) {
	codes, err := GenerateRecoveryCodes()
	if err != nil {
		t.Fatalf("recovery codes: %v", err)
	}
	if len(codes) != RecoveryCodeCount {
		t.Fatalf("got %d codes, want %d", len(codes), RecoveryCodeCount)
	}
	seen := map[string]bool{}
	for _, code := range codes {
		if seen[code] {
			t.Fatalf("duplicate recovery code %q", code)
		}
		seen[code] = true
		if !ValidRecoveryCode(code) {
			t.Errorf("generated code %q does not validate", code)
		}
	}
}
