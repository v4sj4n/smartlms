package config

import "os"

type Config struct {
	Port         string
	DatabasePath string
	// Secret enforcing AES-256-GCM encryption of provider API keys at rest.
	// Set AI_ENCRYPTION_SECRET in any real deployment; the dev default only
	// exists so local development starts without extra setup.
	EncryptionSecret string
}

func Load() Config {
	const devSecret = "dev-insecure-encryption-secret"
	return Config{
		Port:             getEnv("PORT", "8081"),
		DatabasePath:     getEnv("DB_PATH", "optimolms.db"),
		EncryptionSecret: getEnv("AI_ENCRYPTION_SECRET", devSecret),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
