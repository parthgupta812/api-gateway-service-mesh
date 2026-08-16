// Package healthcheck runs periodic background health probes against
// registered backend instances and updates their health state so the
// load balancer can route around unhealthy instances automatically.
package healthcheck

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"apigateway/internal/registry"
)

// Options configures the background health checker.
type Options struct {
	// Interval is how often each instance is probed.
	Interval time.Duration
	// Timeout is the per-probe HTTP timeout.
	Timeout time.Duration
	// Path is the health endpoint path probed on each instance, e.g. "/health".
	Path string
}

// Run starts a goroutine per instance that periodically probes its health
// endpoint and updates the instance's health state in the registry. Run
// returns immediately; probing stops when ctx is cancelled.
func Run(ctx context.Context, registries map[string]*registry.Registry, opts Options, logger *slog.Logger) {
	client := &http.Client{Timeout: opts.Timeout}

	for name, reg := range registries {
		for _, inst := range reg.Instances() {
			go probeLoop(ctx, name, inst, client, opts, logger)
		}
	}
}

func probeLoop(ctx context.Context, serviceName string, inst *registry.Instance, client *http.Client, opts Options, logger *slog.Logger) {
	ticker := time.NewTicker(opts.Interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			healthy := probe(ctx, inst.Addr+opts.Path, client)
			wasHealthy := inst.Healthy()
			inst.SetHealthy(healthy)

			if healthy != wasHealthy {
				logger.Info("backend health state changed",
					"service", serviceName,
					"instance", inst.Addr,
					"healthy", healthy,
				)
			}
		}
	}
}

func probe(ctx context.Context, url string, client *http.Client) bool {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return false
	}

	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	return resp.StatusCode >= 200 && resp.StatusCode < 300
}
