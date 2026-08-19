package metrics

import "testing"

func TestCircuitStateValue(t *testing.T) {
	tests := []struct {
		name     string
		expected float64
	}{
		{"closed", 0},
		{"half_open", 1},
		{"open", 2},
		{"unknown_state", -1},
		{"", -1},
	}

	for _, tc := range tests {
		if got := CircuitStateValue(tc.name); got != tc.expected {
			t.Errorf("CircuitStateValue(%q) = %v, want %v", tc.name, got, tc.expected)
		}
	}
}

// TestMetrics_RegisteredWithoutPanic verifies that all package-level
// collectors were registered successfully at init time (promauto panics
// on duplicate/invalid registration, so simply referencing them here
// after import guards against that regressing silently).
func TestMetrics_RegisteredWithoutPanic(t *testing.T) {
	HTTPRequestsTotal.WithLabelValues("GET", "/health", "200").Inc()
	HTTPRequestDuration.WithLabelValues("GET", "/health").Observe(0.001)
	ActiveRequests.Inc()
	ActiveRequests.Dec()
	UpstreamRequestsTotal.WithLabelValues("order", "http://order-1:9002", "success").Inc()
	UpstreamFailuresTotal.WithLabelValues("order", "http://order-1:9002").Inc()
	RateLimitedRequestsTotal.WithLabelValues("/api/orders").Inc()
	CircuitBreakerState.WithLabelValues("order", "http://order-1:9002").Set(0)
	CircuitBreakerRejectionsTotal.WithLabelValues("order").Inc()
}
