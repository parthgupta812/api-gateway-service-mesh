package middleware

import (
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"apigateway/internal/telemetry"
)

// RecentRequests returns Gin middleware that records proxied API requests
// into a bounded in-memory ring buffer for the dashboard's recent-traffic
// view. Only `/api/*` routes are recorded, since those are the requests
// that actually traverse the proxy to an upstream; gateway-local endpoints
// (/health, /metrics, /gateway/*) are skipped so the view reflects real
// application traffic rather than monitoring noise.
func RecentRequests(buf *telemetry.RecentRequests) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		c.Next()

		if !strings.HasPrefix(c.Request.URL.Path, "/api/") {
			return
		}

		upstream := ""
		if v, ok := c.Get("upstream"); ok {
			if s, ok := v.(string); ok {
				upstream = s
			}
		}

		route := c.FullPath()
		if route == "" {
			route = c.Request.URL.Path
		}

		size := c.Writer.Size()
		if size < 0 {
			size = 0
		}

		buf.Add(telemetry.Request{
			Time:         start,
			Method:       c.Request.Method,
			Route:        c.Request.URL.Path,
			Status:       c.Writer.Status(),
			LatencyMs:    time.Since(start).Milliseconds(),
			Upstream:     upstream,
			ResponseSize: size,
		})
	}
}
