package router

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"

	"apigateway/internal/config"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func newTestRedis(t *testing.T) *redis.Client {
	t.Helper()
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}
	t.Cleanup(mr.Close)
	return redis.NewClient(&redis.Options{Addr: mr.Addr()})
}

// fakeBackend spins up an httptest server that identifies itself in JSON
// responses, mimicking the real mock services used in Docker.
func fakeBackend(t *testing.T, name string) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{"service": name, "path": r.URL.Path})
	}))
	t.Cleanup(srv.Close)
	return srv
}

func baseTestConfig(userURL, orderURLs, productURL string) *config.Config {
	return &config.Config{
		GatewayPort:                    "8080",
		RateLimitRequests:              1000,
		RateLimitWindow:                time.Minute,
		HealthCheckInterval:            time.Hour, // effectively disabled for these tests
		HealthCheckTimeout:             time.Second,
		HealthCheckPath:                "/health",
		CircuitBreakerFailureThreshold: 2,
		CircuitBreakerRecoveryTimeout:  200 * time.Millisecond,
		UserServiceInstances:           []string{userURL},
		OrderServiceInstances:          splitCSV(orderURLs),
		ProductServiceInstances:        []string{productURL},
	}
}

func splitCSV(s string) []string {
	var out []string
	cur := ""
	for _, c := range s {
		if c == ',' {
			out = append(out, cur)
			cur = ""
			continue
		}
		cur += string(c)
	}
	out = append(out, cur)
	return out
}

func TestRouter_UserRoutingWorksEndToEnd(t *testing.T) {

	userSrv := fakeBackend(t, "user-service")
	orderSrv := fakeBackend(t, "order-service")
	productSrv := fakeBackend(t, "product-service")

	cfg := baseTestConfig(userSrv.URL, orderSrv.URL, productSrv.URL)
	redisClient := newTestRedis(t)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	engine, _, err := New(ctx, cfg, redisClient, testLogger())
	if err != nil {
		t.Fatalf("New returned error: %v", err)
	}

	gatewayServer := httptest.NewServer(engine)
	defer gatewayServer.Close()

	resp, err := http.Get(gatewayServer.URL + "/api/users/42")
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var body map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body["service"] != "user-service" {
		t.Errorf("expected request to reach user-service, got %q", body["service"])
	}
	if body["path"] != "/users/42" {
		t.Errorf("expected path /users/42, got %q", body["path"])
	}
}

func TestRouter_ProductRoutingWorksEndToEnd(t *testing.T) {

	userSrv := fakeBackend(t, "user-service")
	orderSrv := fakeBackend(t, "order-service")
	productSrv := fakeBackend(t, "product-service")

	cfg := baseTestConfig(userSrv.URL, orderSrv.URL, productSrv.URL)
	redisClient := newTestRedis(t)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	engine, _, err := New(ctx, cfg, redisClient, testLogger())
	if err != nil {
		t.Fatalf("New returned error: %v", err)
	}

	gatewayServer := httptest.NewServer(engine)
	defer gatewayServer.Close()

	resp, err := http.Get(gatewayServer.URL + "/api/products")
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	var body map[string]string
	json.NewDecoder(resp.Body).Decode(&body)
	if body["service"] != "product-service" {
		t.Errorf("expected product-service, got %q", body["service"])
	}
}

func TestRouter_OrderLoadBalancingAcrossInstances(t *testing.T) {

	userSrv := fakeBackend(t, "user-service")
	productSrv := fakeBackend(t, "product-service")
	order1 := fakeBackend(t, "order-1")
	order2 := fakeBackend(t, "order-2")
	order3 := fakeBackend(t, "order-3")

	orderURLs := fmt.Sprintf("%s,%s,%s", order1.URL, order2.URL, order3.URL)
	cfg := baseTestConfig(userSrv.URL, orderURLs, productSrv.URL)
	redisClient := newTestRedis(t)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	engine, _, err := New(ctx, cfg, redisClient, testLogger())
	if err != nil {
		t.Fatalf("New returned error: %v", err)
	}

	gatewayServer := httptest.NewServer(engine)
	defer gatewayServer.Close()

	seen := map[string]int{}
	for i := 0; i < 9; i++ {
		resp, err := http.Get(gatewayServer.URL + "/api/orders")
		if err != nil {
			t.Fatalf("request %d failed: %v", i, err)
		}
		var body map[string]string
		json.NewDecoder(resp.Body).Decode(&body)
		resp.Body.Close()
		seen[body["service"]]++
	}

	for _, name := range []string{"order-1", "order-2", "order-3"} {
		if seen[name] != 3 {
			t.Errorf("expected %s to receive 3 requests, got %d (distribution: %v)", name, seen[name], seen)
		}
	}
}

func TestRouter_RateLimitReturns429AfterLimit(t *testing.T) {

	userSrv := fakeBackend(t, "user-service")
	orderSrv := fakeBackend(t, "order-service")
	productSrv := fakeBackend(t, "product-service")

	cfg := baseTestConfig(userSrv.URL, orderSrv.URL, productSrv.URL)
	cfg.RateLimitRequests = 3
	cfg.RateLimitWindow = time.Minute

	redisClient := newTestRedis(t)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	engine, _, err := New(ctx, cfg, redisClient, testLogger())
	if err != nil {
		t.Fatalf("New returned error: %v", err)
	}

	gatewayServer := httptest.NewServer(engine)
	defer gatewayServer.Close()

	var statuses []int
	for i := 0; i < 5; i++ {
		resp, err := http.Get(gatewayServer.URL + "/api/users")
		if err != nil {
			t.Fatalf("request %d failed: %v", i, err)
		}
		statuses = append(statuses, resp.StatusCode)
		resp.Body.Close()
	}

	for i := 0; i < 3; i++ {
		if statuses[i] != http.StatusOK {
			t.Errorf("request %d: expected 200, got %d", i, statuses[i])
		}
	}
	for i := 3; i < 5; i++ {
		if statuses[i] != http.StatusTooManyRequests {
			t.Errorf("request %d: expected 429, got %d", i, statuses[i])
		}
	}
}

func TestRouter_CircuitBreakerOpensAndRecoversEndToEnd(t *testing.T) {

	userSrv := fakeBackend(t, "user-service")
	productSrv := fakeBackend(t, "product-service")

	failCount := 0
	failing := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		failCount++
		if failCount <= 2 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{"service": "order-failing", "path": r.URL.Path})
	}))
	defer failing.Close()

	healthy := fakeBackend(t, "order-healthy")

	orderURLs := fmt.Sprintf("%s,%s", failing.URL, healthy.URL)
	cfg := baseTestConfig(userSrv.URL, orderURLs, productSrv.URL)
	cfg.CircuitBreakerFailureThreshold = 2
	cfg.CircuitBreakerRecoveryTimeout = 100 * time.Millisecond

	redisClient := newTestRedis(t)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	engine, registries, err := New(ctx, cfg, redisClient, testLogger())
	if err != nil {
		t.Fatalf("New returned error: %v", err)
	}

	gatewayServer := httptest.NewServer(engine)
	defer gatewayServer.Close()

	// Two requests round-robin: failing, healthy, failing, healthy -> the
	// failing instance accumulates 2 failures and trips to Open.
	for i := 0; i < 4; i++ {
		resp, err := http.Get(gatewayServer.URL + "/api/orders")
		if err != nil {
			t.Fatalf("request %d failed: %v", i, err)
		}
		resp.Body.Close()
	}

	for _, inst := range registries["order"].Instances() {
		if inst.Addr == failing.URL {
			if inst.Breaker.State().String() != "open" {
				t.Fatalf("expected failing instance breaker to be open, got %v", inst.Breaker.State())
			}
		}
	}

	// While open, further requests should never reach the failing
	// instance (which would still fail); confirm all subsequent requests
	// succeed and body always says order-healthy.
	for i := 0; i < 4; i++ {
		resp, err := http.Get(gatewayServer.URL + "/api/orders")
		if err != nil {
			t.Fatalf("post-trip request %d failed: %v", i, err)
		}
		var body map[string]string
		json.NewDecoder(resp.Body).Decode(&body)
		resp.Body.Close()
		if body["service"] != "order-healthy" {
			t.Fatalf("expected only healthy instance to serve traffic while breaker open, got %q", body["service"])
		}
	}

	// Wait for recovery timeout so breaker moves to half-open, then the
	// failing instance (now returning 200) should succeed as a probe and
	// close the breaker again.
	time.Sleep(150 * time.Millisecond)

	sawFailingAgain := false
	for i := 0; i < 6; i++ {
		resp, err := http.Get(gatewayServer.URL + "/api/orders")
		if err != nil {
			t.Fatalf("post-recovery request %d failed: %v", i, err)
		}
		var body map[string]string
		json.NewDecoder(resp.Body).Decode(&body)
		resp.Body.Close()
		if body["service"] == "order-failing" {
			sawFailingAgain = true
		}
	}

	if !sawFailingAgain {
		t.Fatal("expected previously-failing instance to rejoin rotation after recovering")
	}
}
