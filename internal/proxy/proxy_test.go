package proxy

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"apigateway/internal/circuitbreaker"
	"apigateway/internal/registry"
)

func TestReverseProxy_ForwardsAndRewritesPath(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Fake upstream service that echoes back the path it received.
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(r.URL.Path))
	}))
	defer upstream.Close()

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	handler, err := NewReverseProxy(upstream.URL, "/api/users", logger)
	if err != nil {
		t.Fatalf("NewReverseProxy returned error: %v", err)
	}

	engine := gin.New()
	engine.Any("/api/users/*proxyPath", handler)
	engine.Any("/api/users", handler)

	// Serve through a real HTTP server rather than httptest.ResponseRecorder:
	// gin's ResponseWriter implements CloseNotify by delegating to the
	// underlying writer, which panics against a bare ResponseRecorder.
	gatewayServer := httptest.NewServer(engine)
	defer gatewayServer.Close()

	tests := []struct {
		requestPath  string
		expectedPath string
	}{
		{"/api/users/123", "/users/123"},
		{"/api/users", "/users"},
	}

	for _, tc := range tests {
		resp, err := http.Get(gatewayServer.URL + tc.requestPath)
		if err != nil {
			t.Fatalf("request %s: %v", tc.requestPath, err)
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			t.Fatalf("request %s: failed reading body: %v", tc.requestPath, err)
		}

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("request %s: expected status 200, got %d", tc.requestPath, resp.StatusCode)
		}
		if got := string(body); got != tc.expectedPath {
			t.Errorf("request %s: expected upstream path %q, got %q", tc.requestPath, tc.expectedPath, got)
		}
	}
}

func TestNewReverseProxy_InvalidTarget(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	// A control character makes url.Parse fail.
	_, err := NewReverseProxy("http://\x7f", "/api/users", logger)
	if err == nil {
		t.Fatal("expected error for invalid target URL, got nil")
	}
}

func TestLoadBalancedProxy_DistributesAcrossInstances(t *testing.T) {
	gin.SetMode(gin.TestMode)

	makeUpstream := func(name string) *httptest.Server {
		return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(name))
		}))
	}

	upstreamA := makeUpstream("A")
	upstreamB := makeUpstream("B")
	upstreamC := makeUpstream("C")
	defer upstreamA.Close()
	defer upstreamB.Close()
	defer upstreamC.Close()

	reg := registry.New([]string{upstreamA.URL, upstreamB.URL, upstreamC.URL})
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	handler := NewLoadBalancedProxy(reg, "/api/orders", "order", logger)

	engine := gin.New()
	engine.Any("/api/orders", handler)
	engine.Any("/api/orders/*proxyPath", handler)

	gatewayServer := httptest.NewServer(engine)
	defer gatewayServer.Close()

	counts := map[string]int{}
	for i := 0; i < 9; i++ {
		resp, err := http.Get(gatewayServer.URL + "/api/orders")
		if err != nil {
			t.Fatalf("request %d failed: %v", i, err)
		}
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		counts[string(body)]++
	}

	for _, name := range []string{"A", "B", "C"} {
		if counts[name] != 3 {
			t.Errorf("expected upstream %s to receive 3 requests, got %d", name, counts[name])
		}
	}
}

func TestLoadBalancedProxy_SkipsUnhealthyInstance(t *testing.T) {
	gin.SetMode(gin.TestMode)

	upstreamA := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("A"))
	}))
	upstreamB := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("B"))
	}))
	defer upstreamA.Close()
	defer upstreamB.Close()

	reg := registry.New([]string{upstreamA.URL, upstreamB.URL})
	for _, inst := range reg.Instances() {
		if inst.Addr == upstreamB.URL {
			inst.SetHealthy(false)
		}
	}

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	handler := NewLoadBalancedProxy(reg, "/api/orders", "order", logger)

	engine := gin.New()
	engine.Any("/api/orders", handler)

	gatewayServer := httptest.NewServer(engine)
	defer gatewayServer.Close()

	for i := 0; i < 4; i++ {
		resp, err := http.Get(gatewayServer.URL + "/api/orders")
		if err != nil {
			t.Fatalf("request %d failed: %v", i, err)
		}
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		if string(body) != "A" {
			t.Fatalf("expected all requests to reach healthy instance A, got %q", string(body))
		}
	}
}

func TestLoadBalancedProxy_NoHealthyInstancesReturns503(t *testing.T) {
	gin.SetMode(gin.TestMode)

	reg := registry.New([]string{"http://unused:1"})
	reg.Instances()[0].SetHealthy(false)

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	handler := NewLoadBalancedProxy(reg, "/api/orders", "order", logger)

	engine := gin.New()
	engine.Any("/api/orders", handler)

	gatewayServer := httptest.NewServer(engine)
	defer gatewayServer.Close()

	resp, err := http.Get(gatewayServer.URL + "/api/orders")
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Errorf("expected status 503, got %d", resp.StatusCode)
	}
}

func TestLoadBalancedProxy_CircuitBreakerOpensAfterFailures(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Upstream that always returns 500, simulating a failing instance.
	failingUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer failingUpstream.Close()

	healthyUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("healthy"))
	}))
	defer healthyUpstream.Close()

	reg := registry.NewWithBreakerOptions(
		[]string{failingUpstream.URL, healthyUpstream.URL},
		circuitbreaker.Options{FailureThreshold: 2, RecoveryTimeout: time.Minute},
	)

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	handler := NewLoadBalancedProxy(reg, "/api/orders", "order", logger)

	engine := gin.New()
	engine.Any("/api/orders", handler)

	gatewayServer := httptest.NewServer(engine)
	defer gatewayServer.Close()

	// Two requests hit the failing instance (round robin: fail, healthy,
	// fail, healthy...), tripping its breaker to Open after 2 failures.
	for i := 0; i < 4; i++ {
		resp, err := http.Get(gatewayServer.URL + "/api/orders")
		if err != nil {
			t.Fatalf("request %d failed: %v", i, err)
		}
		resp.Body.Close()
	}

	var failingInstance *registry.Instance
	for _, inst := range reg.Instances() {
		if inst.Addr == failingUpstream.URL {
			failingInstance = inst
		}
	}
	if failingInstance == nil {
		t.Fatal("could not find failing instance in registry")
	}
	if failingInstance.Breaker.State() != circuitbreaker.Open {
		t.Fatalf("expected failing instance's breaker to be Open, got %v", failingInstance.Breaker.State())
	}

	// Further requests should only ever reach the healthy instance now.
	for i := 0; i < 6; i++ {
		resp, err := http.Get(gatewayServer.URL + "/api/orders")
		if err != nil {
			t.Fatalf("post-trip request %d failed: %v", i, err)
		}
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		if string(body) != "healthy" {
			t.Fatalf("expected request to be routed only to healthy instance, got body %q", string(body))
		}
	}
}
