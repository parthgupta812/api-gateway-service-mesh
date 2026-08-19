package router

import (
	"context"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"

	"apigateway/internal/config"
	"apigateway/internal/registry"
	"apigateway/internal/telemetry"
)

// serviceLabels gives each logical service a stable display name and order
// for the dashboard's topology view.
var serviceLabels = []struct {
	Key   string
	Label string
}{
	{"user", "User Service"},
	{"order", "Order Service"},
	{"product", "Product Service"},
}

type instanceView struct {
	Addr            string `json:"addr"`
	Name            string `json:"name"`
	Healthy         bool   `json:"healthy"`
	CircuitState    string `json:"circuitState"`
	Failures        int    `json:"failures"`
	LastStateChange string `json:"lastStateChange"`
}

type serviceView struct {
	Key       string         `json:"key"`
	Label     string         `json:"label"`
	Instances []instanceView `json:"instances"`
	Healthy   int            `json:"healthy"`
	Total     int            `json:"total"`
}

type configView struct {
	RateLimitRequests                    int `json:"rateLimitRequests"`
	RateLimitWindowSeconds               int `json:"rateLimitWindowSeconds"`
	HealthCheckIntervalSeconds           int `json:"healthCheckIntervalSeconds"`
	CircuitBreakerFailureThreshold       int `json:"circuitBreakerFailureThreshold"`
	CircuitBreakerRecoveryTimeoutSeconds int `json:"circuitBreakerRecoveryTimeoutSeconds"`
}

type topologyResponse struct {
	Status        string        `json:"status"`
	Redis         string        `json:"redis"`
	UptimeSeconds int64         `json:"uptimeSeconds"`
	StartedAt     string        `json:"startedAt"`
	Services      []serviceView `json:"services"`
	Config        configView    `json:"config"`
}

// topologyHandler exposes a read-only snapshot of the gateway's live
// routing state: which instances exist per service, whether the health
// checker considers them healthy, and each instance's circuit breaker
// state. This information is not derivable from Prometheus alone (metric
// series only appear after an instance has served traffic), so the
// dashboard reads it from here.
func topologyHandler(
	cfg *config.Config,
	registries map[string]*registry.Registry,
	redisClient *redis.Client,
	startedAt time.Time,
) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()

		redisStatus := "ok"
		if err := redisClient.Ping(ctx).Err(); err != nil {
			redisStatus = "unavailable"
		}

		services := make([]serviceView, 0, len(serviceLabels))
		allHealthy := true

		for _, meta := range serviceLabels {
			reg, ok := registries[meta.Key]
			if !ok {
				continue
			}

			instances := reg.Instances()
			view := serviceView{
				Key:       meta.Key,
				Label:     meta.Label,
				Instances: make([]instanceView, 0, len(instances)),
				Total:     len(instances),
			}

			for _, inst := range instances {
				healthy := inst.Healthy()
				if healthy {
					view.Healthy++
				} else {
					allHealthy = false
				}

				view.Instances = append(view.Instances, instanceView{
					Addr:            inst.Addr,
					Name:            instanceName(inst.Addr),
					Healthy:         healthy,
					CircuitState:    inst.Breaker.State().String(),
					Failures:        inst.Breaker.Failures(),
					LastStateChange: inst.Breaker.LastStateChange().UTC().Format(time.RFC3339),
				})
			}

			services = append(services, view)
		}

		status := "operational"
		if redisStatus != "ok" {
			status = "degraded"
		} else if !allHealthy {
			status = "degraded"
		}

		c.JSON(200, topologyResponse{
			Status:        status,
			Redis:         redisStatus,
			UptimeSeconds: int64(time.Since(startedAt).Seconds()),
			StartedAt:     startedAt.UTC().Format(time.RFC3339),
			Services:      services,
			Config: configView{
				RateLimitRequests:                    cfg.RateLimitRequests,
				RateLimitWindowSeconds:               int(cfg.RateLimitWindow.Seconds()),
				HealthCheckIntervalSeconds:           int(cfg.HealthCheckInterval.Seconds()),
				CircuitBreakerFailureThreshold:       cfg.CircuitBreakerFailureThreshold,
				CircuitBreakerRecoveryTimeoutSeconds: int(cfg.CircuitBreakerRecoveryTimeout.Seconds()),
			},
		})
	}
}

// recentRequestsHandler returns the most recent proxied API requests.
// An optional ?limit= query param (default 25) lets the dedicated Recent
// Traffic page request the full buffer, while the dashboard home keeps
// requesting a small snapshot.
func recentRequestsHandler(buf *telemetry.RecentRequests) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 25
		if raw := c.Query("limit"); raw != "" {
			if n, err := strconv.Atoi(raw); err == nil && n > 0 {
				limit = n
			}
		}
		c.JSON(200, gin.H{"requests": buf.Snapshot(limit)})
	}
}

// instanceName turns "http://order-service-2:9002" into "order-service-2"
// for display purposes.
func instanceName(addr string) string {
	host := addr
	if i := strings.Index(host, "://"); i >= 0 {
		host = host[i+3:]
	}
	if i := strings.Index(host, ":"); i >= 0 {
		host = host[:i]
	}
	return host
}
