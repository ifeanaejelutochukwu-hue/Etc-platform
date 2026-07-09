package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port         int
	DatabaseURL  string
	RedisURL     string
	JWTSecret    string
	LiveKitAPIKey     string
	LiveKitAPISecret  string
	LiveKitHost       string
	UploadDir    string
	S3Endpoint   string
	S3AccessKey  string
	S3SecretKey  string
	S3Bucket     string
}

func Load() *Config {
	return &Config{
		Port:            getEnvInt("PORT", 8080),
		DatabaseURL:     getEnv("DATABASE_URL", "postgres://etc:etc@localhost:5432/etc?sslmode=disable"),
		RedisURL:        getEnv("REDIS_URL", "redis://localhost:6379/0"),
		JWTSecret:       getEnv("JWT_SECRET", "dev-secret"),
		LiveKitAPIKey:   getEnv("LIVEKIT_API_KEY", "devkey"),
		LiveKitAPISecret: getEnv("LIVEKIT_API_SECRET", "devsecret"),
		LiveKitHost:     getEnv("LIVEKIT_HOST", "localhost:7880"),
		UploadDir:       getEnv("UPLOAD_DIR", "./uploads"),
		S3Endpoint:      getEnv("S3_ENDPOINT", "http://localhost:9000"),
		S3AccessKey:     getEnv("S3_ACCESS_KEY", "minioadmin"),
		S3SecretKey:     getEnv("S3_SECRET_KEY", "minioadmin"),
		S3Bucket:        getEnv("S3_BUCKET", "etc-media"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}
