package middleware

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"apigateway/internal/metrics"
	"apigateway/internal/ratelimit"
)

// RateLimit returns Gin middleware that enforces a per-client request rate
// limit using the given limiter, keyed by client IP. It sets standard
// rate-limit response headers and returns HTTP 429 once the limit is
// exceeded.
func RateLimit(limiter *ratelimit.Limiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		clientKey := c.ClientIP()

		result, err := limiter.Allow(c.Request.Context(), clientKey)
		if err != nil {
			// Fail open: if Redis is unavailable, don't block traffic on
			// rate limiting alone, but surface the problem via the header.
			c.Header("X-RateLimit-Error", "rate limiter unavailable")
			c.Next()
			return
		}

		c.Header("X-RateLimit-Limit", strconv.Itoa(result.Limit))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(result.Remaining))

		if !result.Allowed {
			retryAfterSeconds := int(result.RetryAfter.Seconds())
			if retryAfterSeconds < 1 {
				retryAfterSeconds = 1
			}
			c.Header("Retry-After", strconv.Itoa(retryAfterSeconds))
			metrics.RateLimitedRequestsTotal.WithLabelValues(routeLabel(c)).Inc()
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":       "rate limit exceeded",
				"limit":       result.Limit,
				"retry_after": fmt.Sprintf("%ds", retryAfterSeconds),
			})
			return
		}

		c.Next()
	}
}
