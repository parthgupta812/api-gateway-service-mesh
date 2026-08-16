package middleware

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"apigateway/internal/metrics"
)

// Metrics returns Gin middleware that records Prometheus metrics for
// every request: total count, latency, and active in-flight requests.
// It uses the registered route pattern (e.g. "/api/users/*proxyPath")
// rather than the raw request path as a label, to avoid unbounded
// cardinality from arbitrary user-supplied URLs.
func Metrics() gin.HandlerFunc {
	return func(c *gin.Context) {
		metrics.ActiveRequests.Inc()
		defer metrics.ActiveRequests.Dec()

		start := time.Now()
		c.Next()
		duration := time.Since(start).Seconds()

		route := c.FullPath()
		if route == "" {
			route = "unmatched"
		}

		status := strconv.Itoa(c.Writer.Status())

		metrics.HTTPRequestsTotal.WithLabelValues(c.Request.Method, route, status).Inc()
		metrics.HTTPRequestDuration.WithLabelValues(c.Request.Method, route).Observe(duration)
	}
}

// routeLabel returns the registered route pattern for the current
// request, falling back to "unmatched" so metric labels never contain
// arbitrary raw request paths.
func routeLabel(c *gin.Context) string {
	if route := c.FullPath(); route != "" {
		return route
	}
	return "unmatched"
}
