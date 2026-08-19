// Package telemetry keeps a small, bounded, in-memory record of recent
// proxied requests so the dashboard can display real per-request traffic.
//
// This is read-only observability state: it never affects routing,
// balancing, rate limiting, or circuit breaking. Memory use is fixed by
// the ring buffer capacity.
package telemetry

import (
	"sync"
	"time"
)

// Request is a single recorded request through the gateway.
type Request struct {
	Time         time.Time `json:"time"`
	Method       string    `json:"method"`
	Route        string    `json:"route"`
	Status       int       `json:"status"`
	LatencyMs    int64     `json:"latencyMs"`
	Upstream     string    `json:"upstream"`
	ResponseSize int       `json:"responseSize"`
}

// RecentRequests is a fixed-capacity, thread-safe ring buffer of the most
// recent requests.
type RecentRequests struct {
	mu    sync.Mutex
	buf   []Request
	next  int
	count int
}

// NewRecentRequests creates a ring buffer holding at most capacity entries.
func NewRecentRequests(capacity int) *RecentRequests {
	if capacity < 1 {
		capacity = 1
	}
	return &RecentRequests{buf: make([]Request, capacity)}
}

// Add records a request, evicting the oldest entry when full.
func (r *RecentRequests) Add(req Request) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.buf[r.next] = req
	r.next = (r.next + 1) % len(r.buf)
	if r.count < len(r.buf) {
		r.count++
	}
}

// Snapshot returns up to limit of the most recent requests, newest first.
func (r *RecentRequests) Snapshot(limit int) []Request {
	r.mu.Lock()
	defer r.mu.Unlock()

	if limit <= 0 || limit > r.count {
		limit = r.count
	}

	out := make([]Request, 0, limit)
	// Walk backwards from the most recently written slot.
	idx := r.next - 1
	for i := 0; i < limit; i++ {
		if idx < 0 {
			idx = len(r.buf) - 1
		}
		out = append(out, r.buf[idx])
		idx--
	}
	return out
}
