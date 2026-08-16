// Package metrics defines and registers the Prometheus metrics exposed by
// the gateway at /metrics.
//
// Label cardinality is kept deliberately low: only method, route
// (registered route pattern, not raw path), status class, and logical
// service name are used as labels. No user IDs, request IDs, or raw URLs
// are ever used as label values.
package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// HTTPRequestsTotal counts all HTTP requests handled by the gateway.
	HTTPRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "gateway_http_requests_total",
			Help: "Total number of HTTP requests handled by the gateway.",
		},
		[]string{"method", "route", "status"},
	)

	// HTTPRequestDuration observes request latency in seconds.
	HTTPRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "gateway_http_request_duration_seconds",
			Help:    "HTTP request latency in seconds.",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "route"},
	)

	// ActiveRequests tracks the number of requests currently being
	// processed by the gateway.
	ActiveRequests = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "gateway_active_requests",
			Help: "Number of HTTP requests currently being processed.",
		},
	)

	// UpstreamRequestsTotal counts requests forwarded to upstream backend
	// services, by logical service name and outcome.
	UpstreamRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "gateway_upstream_requests_total",
			Help: "Total number of requests forwarded to upstream services.",
		},
		[]string{"service", "outcome"},
	)

	// UpstreamFailuresTotal counts failed upstream requests (transport
	// errors or 5xx responses), by logical service name.
	UpstreamFailuresTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "gateway_upstream_failures_total",
			Help: "Total number of failed upstream requests.",
		},
		[]string{"service"},
	)

	// RateLimitedRequestsTotal counts requests rejected by the rate
	// limiter with HTTP 429.
	RateLimitedRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "gateway_rate_limited_requests_total",
			Help: "Total number of requests rejected due to rate limiting.",
		},
		[]string{"route"},
	)

	// CircuitBreakerState reports the current state of each backend
	// instance's circuit breaker as a gauge: 0=closed, 1=half_open, 2=open.
	CircuitBreakerState = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "gateway_circuit_breaker_state",
			Help: "Current circuit breaker state per service (0=closed, 1=half_open, 2=open).",
		},
		[]string{"service", "instance"},
	)

	// CircuitBreakerRejectionsTotal counts requests rejected because the
	// circuit breaker for the selected instance was open.
	CircuitBreakerRejectionsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "gateway_circuit_breaker_rejections_total",
			Help: "Total number of requests rejected because no instance was available (unhealthy or circuit open).",
		},
		[]string{"service"},
	)
)

// CircuitStateValue maps a breaker state name to the numeric gauge value
// used by CircuitBreakerState.
func CircuitStateValue(stateName string) float64 {
	switch stateName {
	case "closed":
		return 0
	case "half_open":
		return 1
	case "open":
		return 2
	default:
		return -1
	}
}
