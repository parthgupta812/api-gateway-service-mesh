// Package proxy implements reverse-proxy forwarding to backend services.
package proxy

import (
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"

	"apigateway/internal/metrics"
	"apigateway/internal/registry"
)

// NewReverseProxy builds a Gin handler that forwards requests to target,
// stripping the given prefix from the incoming request path before
// forwarding. For example, with prefix "/api/users" a request for
// "/api/users/123" is forwarded to target + "/users/123".
func NewReverseProxy(target string, prefix string, logger *slog.Logger) (gin.HandlerFunc, error) {
	targetURL, err := url.Parse(target)
	if err != nil {
		return nil, err
	}

	// Rewrite prefix -> service base path (drop the "/api" segment).
	// "/api/users" becomes "/users"
	servicePrefix := strings.TrimPrefix(prefix, "/api")

	reverseProxy := &httputil.ReverseProxy{
		Director: func(req *http.Request) {
			req.URL.Scheme = targetURL.Scheme
			req.URL.Host = targetURL.Host
			req.Host = targetURL.Host

			trimmed := strings.TrimPrefix(req.URL.Path, prefix)
			if trimmed == "" || trimmed == "/" {
				req.URL.Path = servicePrefix
			} else {
				req.URL.Path = servicePrefix + trimmed
			}
		},
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			logger.Error("upstream request failed",
				"path", r.URL.Path,
				"target", target,
				"error", err.Error(),
			)
			w.WriteHeader(http.StatusBadGateway)
			_, _ = w.Write([]byte(`{"error":"upstream service unavailable"}`))
		},
	}

	return func(c *gin.Context) {
		c.Set("upstream", target)
		reverseProxy.ServeHTTP(c.Writer, c.Request)
	}, nil
}

// NewLoadBalancedProxy builds a Gin handler that forwards requests to one
// of several backend instances tracked by reg, selected round-robin among
// currently available (healthy + circuit-closed) instances. Like
// NewReverseProxy, it strips prefix from the incoming request path before
// forwarding. serviceName is a low-cardinality label (e.g. "order") used
// for metrics.
func NewLoadBalancedProxy(reg *registry.Registry, prefix, serviceName string, logger *slog.Logger) gin.HandlerFunc {
	servicePrefix := strings.TrimPrefix(prefix, "/api")

	return func(c *gin.Context) {
		instance := reg.Next()
		if instance == nil {
			metrics.CircuitBreakerRejectionsTotal.WithLabelValues(serviceName).Inc()
			logger.Error("no available backend instances (unhealthy or circuit open)", "service", serviceName, "prefix", prefix)
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
				"error": "no healthy backend instances available",
			})
			return
		}

		targetURL, err := url.Parse(instance.Addr)
		if err != nil {
			logger.Error("invalid backend instance address", "addr", instance.Addr, "error", err.Error())
			c.AbortWithStatusJSON(http.StatusBadGateway, gin.H{
				"error": "invalid upstream configuration",
			})
			return
		}

		c.Set("upstream", instance.Addr)

		upstreamFailed := false

		reverseProxy := &httputil.ReverseProxy{
			Director: func(req *http.Request) {
				req.URL.Scheme = targetURL.Scheme
				req.URL.Host = targetURL.Host
				req.Host = targetURL.Host

				trimmed := strings.TrimPrefix(req.URL.Path, prefix)
				if trimmed == "" || trimmed == "/" {
					req.URL.Path = servicePrefix
				} else {
					req.URL.Path = servicePrefix + trimmed
				}
			},
			ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
				upstreamFailed = true
				logger.Error("upstream request failed",
					"path", r.URL.Path,
					"target", instance.Addr,
					"error", err.Error(),
				)
				w.WriteHeader(http.StatusBadGateway)
				_, _ = w.Write([]byte(`{"error":"upstream service unavailable"}`))
			},
		}

		reverseProxy.ServeHTTP(c.Writer, c.Request)

		if upstreamFailed || c.Writer.Status() >= http.StatusInternalServerError {
			upstreamFailed = true
		}

		if upstreamFailed {
			instance.Breaker.RecordFailure()
			metrics.UpstreamRequestsTotal.WithLabelValues(serviceName, "failure").Inc()
			metrics.UpstreamFailuresTotal.WithLabelValues(serviceName).Inc()
		} else {
			instance.Breaker.RecordSuccess()
			metrics.UpstreamRequestsTotal.WithLabelValues(serviceName, "success").Inc()
		}

		metrics.CircuitBreakerState.WithLabelValues(serviceName, instance.Addr).Set(
			metrics.CircuitStateValue(instance.Breaker.State().String()),
		)
	}
}
