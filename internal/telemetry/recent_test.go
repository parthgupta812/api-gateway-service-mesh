package telemetry

import (
	"sync"
	"testing"
	"time"
)

func TestRecentRequests_ReturnsNewestFirst(t *testing.T) {
	r := NewRecentRequests(5)

	for i := 1; i <= 3; i++ {
		r.Add(Request{Method: "GET", Route: "/api/orders", Status: 200, LatencyMs: int64(i)})
	}

	got := r.Snapshot(0)
	if len(got) != 3 {
		t.Fatalf("expected 3 entries, got %d", len(got))
	}
	if got[0].LatencyMs != 3 {
		t.Errorf("expected newest entry first (latency 3), got %d", got[0].LatencyMs)
	}
	if got[2].LatencyMs != 1 {
		t.Errorf("expected oldest entry last (latency 1), got %d", got[2].LatencyMs)
	}
}

func TestRecentRequests_EvictsOldestWhenFull(t *testing.T) {
	r := NewRecentRequests(3)

	for i := 1; i <= 5; i++ {
		r.Add(Request{Route: "/api/users", LatencyMs: int64(i)})
	}

	got := r.Snapshot(0)
	if len(got) != 3 {
		t.Fatalf("expected buffer capped at 3, got %d", len(got))
	}
	// Newest first: 5, 4, 3 (1 and 2 evicted).
	expected := []int64{5, 4, 3}
	for i, want := range expected {
		if got[i].LatencyMs != want {
			t.Errorf("entry %d: expected latency %d, got %d", i, want, got[i].LatencyMs)
		}
	}
}

func TestRecentRequests_RespectsLimit(t *testing.T) {
	r := NewRecentRequests(10)
	for i := 0; i < 6; i++ {
		r.Add(Request{Route: "/api/products"})
	}

	if got := r.Snapshot(2); len(got) != 2 {
		t.Errorf("expected 2 entries when limit=2, got %d", len(got))
	}
}

func TestRecentRequests_EmptyBuffer(t *testing.T) {
	r := NewRecentRequests(4)
	if got := r.Snapshot(0); len(got) != 0 {
		t.Errorf("expected no entries from empty buffer, got %d", len(got))
	}
}

func TestRecentRequests_ConcurrentAccessIsRaceFree(t *testing.T) {
	r := NewRecentRequests(50)

	var wg sync.WaitGroup
	for i := 0; i < 60; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			r.Add(Request{Time: time.Now(), Route: "/api/orders", Status: 200})
		}()
	}
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			r.Snapshot(10)
		}()
	}
	wg.Wait()
}
