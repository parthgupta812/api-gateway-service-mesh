package config

import (
	"os"
	"testing"
	"time"
)

func TestLoad_Defaults(t *testing.T) {
	// Ensure a clean env for the vars we care about.
	for _, key := range []string{
		"GATEWAY_PORT", "REDIS_HOST", "REDIS_PORT",
		"USER_SERVICE_URL", "ORDER_SERVICE_URL", "PRODUCT_SERVICE_URL",
		"RATE_LIMIT_REQUESTS", "RATE_LIMIT_WINDOW_SECONDS",
		"HEALTH_CHECK_INTERVAL_SECONDS", "HEALTH_CHECK_TIMEOUT_SECONDS", "HEALTH_CHECK_PATH",
		"CIRCUIT_BREAKER_FAILURE_THRESHOLD", "CIRCUIT_BREAKER_RECOVERY_TIMEOUT_SECONDS",
	} {
		os.Unsetenv(key)
	}

	cfg := Load()

	if cfg.GatewayPort != "8080" {
		t.Errorf("expected default GatewayPort 8080, got %s", cfg.GatewayPort)
	}
	if cfg.RedisHost != "localhost" {
		t.Errorf("expected default RedisHost localhost, got %s", cfg.RedisHost)
	}
	if cfg.RedisPort != "6379" {
		t.Errorf("expected default RedisPort 6379, got %s", cfg.RedisPort)
	}
	if len(cfg.OrderServiceInstances) != 1 || cfg.OrderServiceInstances[0] != "http://localhost:9002" {
		t.Errorf("expected single default order service instance, got %v", cfg.OrderServiceInstances)
	}
	if cfg.RateLimitRequests != 100 {
		t.Errorf("expected default RateLimitRequests 100, got %d", cfg.RateLimitRequests)
	}
	if cfg.RateLimitWindow != 60*time.Second {
		t.Errorf("expected default RateLimitWindow 60s, got %v", cfg.RateLimitWindow)
	}
	if cfg.HealthCheckInterval != 5*time.Second {
		t.Errorf("expected default HealthCheckInterval 5s, got %v", cfg.HealthCheckInterval)
	}
	if cfg.CircuitBreakerFailureThreshold != 5 {
		t.Errorf("expected default CircuitBreakerFailureThreshold 5, got %d", cfg.CircuitBreakerFailureThreshold)
	}
	if cfg.CircuitBreakerRecoveryTimeout != 30*time.Second {
		t.Errorf("expected default CircuitBreakerRecoveryTimeout 30s, got %v", cfg.CircuitBreakerRecoveryTimeout)
	}
}

func TestLoad_CircuitBreakerEnvOverride(t *testing.T) {
	os.Setenv("CIRCUIT_BREAKER_FAILURE_THRESHOLD", "3")
	os.Setenv("CIRCUIT_BREAKER_RECOVERY_TIMEOUT_SECONDS", "15")
	defer os.Unsetenv("CIRCUIT_BREAKER_FAILURE_THRESHOLD")
	defer os.Unsetenv("CIRCUIT_BREAKER_RECOVERY_TIMEOUT_SECONDS")

	cfg := Load()

	if cfg.CircuitBreakerFailureThreshold != 3 {
		t.Errorf("expected CircuitBreakerFailureThreshold 3, got %d", cfg.CircuitBreakerFailureThreshold)
	}
	if cfg.CircuitBreakerRecoveryTimeout != 15*time.Second {
		t.Errorf("expected CircuitBreakerRecoveryTimeout 15s, got %v", cfg.CircuitBreakerRecoveryTimeout)
	}
}

func TestLoad_ParsesMultipleServiceInstances(t *testing.T) {
	os.Setenv("ORDER_SERVICE_URL", "http://order-1:9002, http://order-2:9002 ,http://order-3:9002")
	defer os.Unsetenv("ORDER_SERVICE_URL")

	cfg := Load()

	expected := []string{"http://order-1:9002", "http://order-2:9002", "http://order-3:9002"}
	if len(cfg.OrderServiceInstances) != len(expected) {
		t.Fatalf("expected %d instances, got %d: %v", len(expected), len(cfg.OrderServiceInstances), cfg.OrderServiceInstances)
	}
	for i, addr := range expected {
		if cfg.OrderServiceInstances[i] != addr {
			t.Errorf("instance %d: expected %s, got %s", i, addr, cfg.OrderServiceInstances[i])
		}
	}
}

func TestLoad_RateLimitEnvOverride(t *testing.T) {
	os.Setenv("RATE_LIMIT_REQUESTS", "5")
	os.Setenv("RATE_LIMIT_WINDOW_SECONDS", "10")
	defer os.Unsetenv("RATE_LIMIT_REQUESTS")
	defer os.Unsetenv("RATE_LIMIT_WINDOW_SECONDS")

	cfg := Load()

	if cfg.RateLimitRequests != 5 {
		t.Errorf("expected RateLimitRequests 5, got %d", cfg.RateLimitRequests)
	}
	if cfg.RateLimitWindow != 10*time.Second {
		t.Errorf("expected RateLimitWindow 10s, got %v", cfg.RateLimitWindow)
	}
}

func TestLoad_EnvOverride(t *testing.T) {
	os.Setenv("GATEWAY_PORT", "9999")
	defer os.Unsetenv("GATEWAY_PORT")

	cfg := Load()

	if cfg.GatewayPort != "9999" {
		t.Errorf("expected overridden GatewayPort 9999, got %s", cfg.GatewayPort)
	}
}
