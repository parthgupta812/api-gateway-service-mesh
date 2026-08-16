// Package config loads gateway configuration from environment variables.
package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds all runtime configuration for the API gateway.
type Config struct {
	GatewayPort string
	RedisHost   string
	RedisPort   string

	// *Instances hold one or more backend addresses per service, allowing
	// a service to be load-balanced across multiple instances. Each entry
	// is a comma-separated list of base URLs, e.g.
	// "http://order-service-1:9002,http://order-service-2:9002".
	UserServiceInstances    []string
	OrderServiceInstances   []string
	ProductServiceInstances []string

	// Rate limiting.
	RateLimitRequests int
	RateLimitWindow   time.Duration

	// Health checking.
	HealthCheckInterval time.Duration
	HealthCheckTimeout  time.Duration
	HealthCheckPath     string

	// Circuit breaker (per backend instance).
	CircuitBreakerFailureThreshold int
	CircuitBreakerRecoveryTimeout  time.Duration
}

// Load reads configuration from environment variables, applying sane
// defaults when a variable is not set (useful for local development).
func Load() *Config {
	return &Config{
		GatewayPort: getEnv("GATEWAY_PORT", "8080"),
		RedisHost:   getEnv("REDIS_HOST", "localhost"),
		RedisPort:   getEnv("REDIS_PORT", "6379"),

		UserServiceInstances:    getEnvList("USER_SERVICE_URL", "http://localhost:9001"),
		OrderServiceInstances:   getEnvList("ORDER_SERVICE_URL", "http://localhost:9002"),
		ProductServiceInstances: getEnvList("PRODUCT_SERVICE_URL", "http://localhost:9003"),

		RateLimitRequests: getEnvInt("RATE_LIMIT_REQUESTS", 100),
		RateLimitWindow:   getEnvSeconds("RATE_LIMIT_WINDOW_SECONDS", 60),

		HealthCheckInterval: getEnvSeconds("HEALTH_CHECK_INTERVAL_SECONDS", 5),
		HealthCheckTimeout:  getEnvSeconds("HEALTH_CHECK_TIMEOUT_SECONDS", 2),
		HealthCheckPath:     getEnv("HEALTH_CHECK_PATH", "/health"),

		CircuitBreakerFailureThreshold: getEnvInt("CIRCUIT_BREAKER_FAILURE_THRESHOLD", 5),
		CircuitBreakerRecoveryTimeout:  getEnvSeconds("CIRCUIT_BREAKER_RECOVERY_TIMEOUT_SECONDS", 30),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// getEnvList reads a comma-separated environment variable into a slice of
// trimmed, non-empty values. Falls back to a single-element slice
// containing fallback when unset.
func getEnvList(key, fallback string) []string {
	raw := getEnv(key, fallback)
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	if len(out) == 0 {
		return []string{fallback}
	}
	return out
}

func getEnvInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

func getEnvSeconds(key string, fallbackSeconds int) time.Duration {
	return time.Duration(getEnvInt(key, fallbackSeconds)) * time.Second
}
