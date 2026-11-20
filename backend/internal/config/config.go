package config

import "os"

type Config struct {
	Port         string
	DatabasePath string
}

func Load() Config {
	return Config{
		Port:         getEnv("PORT", "8081"),
		DatabasePath: getEnv("DB_PATH", "smartlms.db"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
