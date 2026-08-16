package healthcheck

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"apigateway/internal/registry"
)

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func TestRun_MarksHealthyInstanceHealthy(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer upstream.Close()

	reg := registry.New([]string{upstream.URL})
	// Start false so we can observe the probe flip it to true.
	reg.Instances()[0].SetHealthy(false)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	Run(ctx, map[string]*registry.Registry{"test": reg}, Options{
		Interval: 20 * time.Millisecond,
		Timeout:  time.Second,
		Path:     "/",
	}, testLogger())

	waitFor(t, time.Second, func() bool {
		return reg.Instances()[0].Healthy()
	})
}

func TestRun_MarksFailingInstanceUnhealthy(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer upstream.Close()

	reg := registry.New([]string{upstream.URL})
	// Starts healthy (registry default); probe should flip it false.
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	Run(ctx, map[string]*registry.Registry{"test": reg}, Options{
		Interval: 20 * time.Millisecond,
		Timeout:  time.Second,
		Path:     "/",
	}, testLogger())

	waitFor(t, time.Second, func() bool {
		return !reg.Instances()[0].Healthy()
	})
}

func TestRun_UnreachableInstanceMarkedUnhealthy(t *testing.T) {
	// Port 1 is reserved/unlikely to be listening; the probe should fail
	// with a transport error and mark the instance unhealthy.
	reg := registry.New([]string{"http://127.0.0.1:1"})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	Run(ctx, map[string]*registry.Registry{"test": reg}, Options{
		Interval: 20 * time.Millisecond,
		Timeout:  200 * time.Millisecond,
		Path:     "/health",
	}, testLogger())

	waitFor(t, 2*time.Second, func() bool {
		return !reg.Instances()[0].Healthy()
	})
}

func TestRun_StopsProbingAfterContextCancelled(t *testing.T) {
	var probeCount atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		probeCount.Add(1)
		w.WriteHeader(http.StatusOK)
	}))
	defer upstream.Close()

	reg := registry.New([]string{upstream.URL})
	ctx, cancel := context.WithCancel(context.Background())

	Run(ctx, map[string]*registry.Registry{"test": reg}, Options{
		Interval: 10 * time.Millisecond,
		Timeout:  time.Second,
		Path:     "/",
	}, testLogger())

	// Let a few probes happen, then cancel and ensure the count stops growing.
	time.Sleep(50 * time.Millisecond)
	cancel()
	countAtCancel := probeCount.Load()

	time.Sleep(100 * time.Millisecond)
	countAfterWait := probeCount.Load()

	if countAfterWait > countAtCancel+1 {
		t.Errorf("expected probing to stop after context cancellation: count at cancel=%d, after wait=%d", countAtCancel, countAfterWait)
	}
}

func TestRun_ProbesMultipleServicesAndInstancesIndependently(t *testing.T) {
	healthyUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer healthyUpstream.Close()

	failingUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer failingUpstream.Close()

	regA := registry.New([]string{healthyUpstream.URL})
	regB := registry.New([]string{failingUpstream.URL})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	Run(ctx, map[string]*registry.Registry{"a": regA, "b": regB}, Options{
		Interval: 20 * time.Millisecond,
		Timeout:  time.Second,
		Path:     "/",
	}, testLogger())

	waitFor(t, time.Second, func() bool {
		return regA.Instances()[0].Healthy() && !regB.Instances()[0].Healthy()
	})
}

// waitFor polls cond until it returns true or the timeout elapses.
func waitFor(t *testing.T, timeout time.Duration, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("condition not met within %v", timeout)
}
