// Package auth provides password hashing (Argon2id, PHC string format)
// and the per-role account lockout policy helpers.
package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"strconv"
	"strings"

	"golang.org/x/crypto/argon2"
)

const (
	argonTime    = 1
	argonMemory  = 64 * 1024 // 64 MiB
	argonThreads = 4
	argonKeyLen  = 32
	saltLen      = 16
)

// HashPassword hashes a plaintext password with Argon2id and returns a
// PHC-formatted string: $argon2id$v=19$m=65536,t=1,p=4$<salt>$<hash>
func HashPassword(password string) (string, error) {
	salt := make([]byte, saltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("generate salt: %w", err)
	}
	hash := argon2.IDKey([]byte(password), salt, argonTime, argonMemory, uint8(argonThreads), argonKeyLen)
	return fmt.Sprintf("$argon2id$v=19$m=%d,t=%d,p=%d$%s$%s",
		argonMemory, argonTime, argonThreads,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(hash)), nil
}

// VerifyPassword checks a plaintext password against a PHC Argon2id hash.
func VerifyPassword(password, phc string) (bool, error) {
	parts := strings.Split(phc, "$")
	if len(parts) != 6 || parts[1] != "argon2id" {
		return false, fmt.Errorf("unsupported hash format")
	}
	params := strings.Split(parts[3], ",")
	m, t, p := uint32(argonMemory), uint32(argonTime), uint32(argonThreads)
	for _, kv := range params {
		k, v, ok := strings.Cut(kv, "=")
		if !ok {
			continue
		}
		n, err := strconv.ParseUint(v, 10, 32)
		if err != nil {
			return false, fmt.Errorf("bad hash params: %w", err)
		}
		switch k {
		case "m":
			m = uint32(n)
		case "t":
			t = uint32(n)
		case "p":
			p = uint32(n)
		}
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return false, fmt.Errorf("bad salt: %w", err)
	}
	want, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return false, fmt.Errorf("bad hash: %w", err)
	}
	got := argon2.IDKey([]byte(password), salt, t, m, uint8(p), uint32(len(want)))
	return subtle.ConstantTimeCompare(got, want) == 1, nil
}
