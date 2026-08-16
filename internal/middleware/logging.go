// Package middleware contains Gin middleware for the API gateway.
package middleware

import (
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
)

// RequestLogger returns Gin middleware that logs each request as
// structured JSON, including method, path, status code, duration and
// the upstream service the request was routed to (if any).
func RequestLogger(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		c.Next()

		duration := time.Since(start)
		upstream, _ := c.Get("upstream")

		logger.Info("request handled",
			"method", c.Request.Method,
			"path", c.Request.URL.Path,
			"status", c.Writer.Status(),
			"duration_ms", duration.Milliseconds(),
			"upstream", upstream,
			"client_ip", c.ClientIP(),
		)
	}
}
