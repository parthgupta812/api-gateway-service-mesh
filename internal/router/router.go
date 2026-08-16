// Package router wires up the gateway's HTTP routes.
package router

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"

	"apigateway/internal/circuitbreaker"
	"apigateway/internal/config"
	"apigateway/internal/healthcheck"
	"apigateway/internal/middleware"
	"apigateway/internal/proxy"
	"apigateway/internal/ratelimit"
	"apigateway/internal/registry"
)

// New builds the fully configured Gin engine for the gateway, along with
// the service registries it created (so callers, e.g. main, can start
// background health checking against them).
func New(ctx context.Context, cfg *config.Config, redisClient *redis.Client, logger *slog.Logger) (*gin.Engine, map[string]*registry.Registry, error) {
	engine := gin.New()
	engine.Use(gin.Recovery())
	engine.Use(middleware.RequestLogger(logger))
	engine.Use(middleware.Metrics())

	limiter := ratelimit.New(redisClient, cfg.RateLimitRequests, cfg.RateLimitWindow)
	engine.Use(middleware.RateLimit(limiter))

	engine.GET("/health", healthHandler(redisClient))
	engine.GET("/metrics", gin.WrapH(promhttp.Handler()))

	breakerOpts := circuitbreaker.Options{
		FailureThreshold: cfg.CircuitBreakerFailureThreshold,
		RecoveryTimeout:  cfg.CircuitBreakerRecoveryTimeout,
	}

	registries := map[string]*registry.Registry{
		"user":    registry.NewWithBreakerOptions(cfg.UserServiceInstances, breakerOpts),
		"order":   registry.NewWithBreakerOptions(cfg.OrderServiceInstances, breakerOpts),
		"product": registry.NewWithBreakerOptions(cfg.ProductServiceInstances, breakerOpts),
	}

	routes := map[string]string{
		"/api/users":    "user",
		"/api/orders":   "order",
		"/api/products": "product",
	}

	for prefix, serviceName := range routes {
		handler := proxy.NewLoadBalancedProxy(registries[serviceName], prefix, serviceName, logger)
		engine.Any(prefix, handler)
		engine.Any(prefix+"/*proxyPath", handler)
	}

	healthcheck.Run(ctx, registries, healthcheck.Options{
		Interval: cfg.HealthCheckInterval,
		Timeout:  cfg.HealthCheckTimeout,
		Path:     cfg.HealthCheckPath,
	}, logger)

	return engine, registries, nil
}

func healthHandler(redisClient *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()

		redisStatus := "ok"
		if err := redisClient.Ping(ctx).Err(); err != nil {
			redisStatus = "unavailable"
		}

		status := http.StatusOK
		overall := "ok"
		if redisStatus != "ok" {
			status = http.StatusServiceUnavailable
			overall = "degraded"
		}

		c.JSON(status, gin.H{
			"status": overall,
			"redis":  redisStatus,
		})
	}
}
