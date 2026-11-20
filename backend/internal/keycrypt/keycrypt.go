// Package keycrypt encrypts provider API keys at rest with AES-256-GCM. The
// data key is derived from a server-side secret with HKDF-SHA256, so stored
// keys are unreadable without the process environment. Plaintext keys exist
// only in memory for the duration of a request and are never serialized back.
package keycrypt

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"

	"golang.org/x/crypto/hkdf"
)

const (
	hkdfSalt = "smartlms:ai:keys:v1"
	hkdfInfo = "ai-provider-api-key"
)

// ErrMalformed reports ciphertext that is truncated or not decodable.
var ErrMalformed = errors.New("malformed ciphertext")

// Crypt seals and opens provider API keys under one derived data key.
type Crypt struct {
	aead cipher.AEAD
}

// New derives the 32-byte data key used for provider API keys.
func New(secret string) (*Crypt, error) {
	return NewLabeled(secret, hkdfInfo)
}

// NewLabeled derives a data key for one labelled purpose. HKDF's info field
// separates the purposes, so material sealed for provider keys can never be
// opened as, say, a two-factor secret even though both derive from one server
// secret.
func NewLabeled(secret, label string) (*Crypt, error) {
	if secret == "" {
		return nil, fmt.Errorf("empty encryption secret")
	}
	if label == "" {
		return nil, fmt.Errorf("empty encryption label")
	}
	reader := hkdf.New(sha256.New, []byte(secret), []byte(hkdfSalt), []byte(label))
	key := make([]byte, 32)
	if _, err := io.ReadFull(reader, key); err != nil {
		return nil, fmt.Errorf("derive key: %w", err)
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("new cipher: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("new gcm: %w", err)
	}
	return &Crypt{aead: aead}, nil
}

// Encrypt returns base64(nonce || ciphertext) for the plaintext key.
func (c *Crypt) Encrypt(plaintext string) (string, error) {
	nonce := make([]byte, c.aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", fmt.Errorf("nonce: %w", err)
	}
	blob := c.aead.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(blob), nil
}

// Decrypt reverses Encrypt. Empty input is treated as "no key stored".
func (c *Crypt) Decrypt(blob string) (string, error) {
	if blob == "" {
		return "", nil
	}
	raw, err := base64.StdEncoding.DecodeString(blob)
	if err != nil {
		return "", ErrMalformed
	}
	if len(raw) < c.aead.NonceSize() {
		return "", ErrMalformed
	}
	nonce, ciphertext := raw[:c.aead.NonceSize()], raw[c.aead.NonceSize():]
	plaintext, err := c.aead.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", ErrMalformed
	}
	return string(plaintext), nil
}

// Hint returns the masked, non-secret reminder stored alongside the key
// ("…d41d"), safe to return in API responses.
func Hint(plaintext string) string {
	if len(plaintext) <= 4 {
		return "••••"
	}
	return "…" + plaintext[len(plaintext)-4:]
}
