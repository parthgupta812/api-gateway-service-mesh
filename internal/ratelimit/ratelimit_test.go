package ratelimit

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

func newTestClient(t *testing.T) *redis.Client {
	t.Helper()
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}
	t.Cleanup(mr.Close)

	return redis.NewClient(&redis.Options{Addr: mr.Addr()})
}

func TestLimiter_AllowsUpToLimit(t *testing.T) {
	client := newTestClient(t)
	limiter := New(client, 3, time.Minute)
	ctx := context.Background()

	for i := 1; i <= 3; i++ {
		res, err := limiter.Allow(ctx, "client-a")
		if err != nil {
			t.Fatalf("request %d: unexpected error: %v", i, err)
		}
		if !res.Allowed {
			t.Fatalf("request %d: expected allowed, got denied", i)
		}
		expectedRemaining := 3 - i
		if res.Remaining != expectedRemaining {
			t.Errorf("request %d: expected remaining %d, got %d", i, expectedRemaining, res.Remaining)
		}
	}
}

func TestLimiter_DeniesOverLimit(t *testing.T) {
	client := newTestClient(t)
	limiter := New(client, 2, time.Minute)
	ctx := context.Background()

	for i := 0; i < 2; i++ {
		if _, err := limiter.Allow(ctx, "client-b"); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	}

	res, err := limiter.Allow(ctx, "client-b")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Allowed {
		t.Fatal("expected request to be denied after exceeding limit")
	}
	if res.Remaining != 0 {
		t.Errorf("expected remaining 0, got %d", res.Remaining)
	}
	if res.RetryAfter <= 0 {
		t.Errorf("expected positive RetryAfter, got %v", res.RetryAfter)
	}
}

func TestLimiter_SeparateClientsHaveSeparateLimits(t *testing.T) {
	client := newTestClient(t)
	limiter := New(client, 1, time.Minute)
	ctx := context.Background()

	resA, err := limiter.Allow(ctx, "client-c")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resA.Allowed {
		t.Fatal("expected first request from client-c to be allowed")
	}

	resB, err := limiter.Allow(ctx, "client-d")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resB.Allowed {
		t.Fatal("expected first request from a different client to be allowed independently")
	}
}

// TestLimiter_ConcurrentRequestsCannotExceedLimit exercises the limiter
// with many goroutines hitting the same client key concurrently, verifying
// that the atomic Redis script prevents more than `limit` requests from
// ever being allowed, even under race conditions.
func TestLimiter_ConcurrentRequestsCannotExceedLimit(t *testing.T) {
	client := newTestClient(t)
	const limit = 10
	limiter := New(client, limit, time.Minute)
	ctx := context.Background()

	const totalRequests = 50
	var wg sync.WaitGroup
	var mu sync.Mutex
	allowedCount := 0

	for i := 0; i < totalRequests; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			res, err := limiter.Allow(ctx, "client-concurrent")
			if err != nil {
				t.Errorf("unexpected error: %v", err)
				return
			}
			if res.Allowed {
				mu.Lock()
				allowedCount++
				mu.Unlock()
			}
		}()
	}

	wg.Wait()

	if allowedCount != limit {
		t.Errorf("expected exactly %d allowed requests, got %d", limit, allowedCount)
	}
}
