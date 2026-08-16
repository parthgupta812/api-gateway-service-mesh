// Package circuitbreaker implements a per-instance circuit breaker with
// the classic CLOSED -> OPEN -> HALF-OPEN -> CLOSED state machine.
//
// It is intentionally self-contained (no external dependencies) so it can
// be embedded per backend instance without coupling to the registry or
// proxy packages.
package circuitbreaker

import (
	"sync"
	"time"
)

// State represents the circuit breaker's current state.
type State int

const (
	// Closed allows all requests through and counts consecutive failures.
	Closed State = iota
	// Open rejects all requests until the recovery timeout elapses.
	Open
	// HalfOpen allows a single probe request through to test recovery.
	HalfOpen
)

// String returns a human-readable name for the state, useful for logging
// and metrics labels.
func (s State) String() string {
	switch s {
	case Closed:
		return "closed"
	case Open:
		return "open"
	case HalfOpen:
		return "half_open"
	default:
		return "unknown"
	}
}

// Options configures a Breaker.
type Options struct {
	// FailureThreshold is the number of consecutive failures required to
	// trip the breaker from CLOSED to OPEN.
	FailureThreshold int
	// RecoveryTimeout is how long the breaker stays OPEN before allowing a
	// single probe request through in HALF-OPEN.
	RecoveryTimeout time.Duration
}

// Breaker is a thread-safe circuit breaker for a single upstream
// instance. The zero value is not usable; construct with New.
type Breaker struct {
	opts Options

	mu               sync.Mutex
	state            State
	consecutiveFails int
	openedAt         time.Time
	probeInFlight    bool
}

// New creates a Breaker with the given options, starting in the CLOSED
// state.
func New(opts Options) *Breaker {
	if opts.FailureThreshold < 1 {
		opts.FailureThreshold = 1
	}
	if opts.RecoveryTimeout <= 0 {
		opts.RecoveryTimeout = 30 * time.Second
	}
	return &Breaker{opts: opts, state: Closed}
}

// State returns the breaker's current state, resolving an elapsed OPEN
// recovery timeout to HALF-OPEN as a side effect (matching Allow's
// transition logic) so callers observe a consistent view.
func (b *Breaker) State() State {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.maybeTransitionToHalfOpen()
	return b.state
}

// maybeTransitionToHalfOpen moves an OPEN breaker to HALF-OPEN once the
// recovery timeout has elapsed. Must be called with mu held.
func (b *Breaker) maybeTransitionToHalfOpen() {
	if b.state == Open && time.Since(b.openedAt) >= b.opts.RecoveryTimeout {
		b.state = HalfOpen
		b.probeInFlight = false
	}
}

// Allow reports whether a request should be permitted to proceed against
// the guarded instance. When the breaker is HALF-OPEN, only a single
// concurrent probe request is allowed through; all others are rejected
// until that probe completes (via RecordSuccess/RecordFailure).
func (b *Breaker) Allow() bool {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.maybeTransitionToHalfOpen()

	switch b.state {
	case Closed:
		return true
	case HalfOpen:
		if b.probeInFlight {
			return false
		}
		b.probeInFlight = true
		return true
	default: // Open
		return false
	}
}

// RecordSuccess reports a successful request. In HALF-OPEN this closes the
// breaker and resets the failure count; in CLOSED it resets the failure
// count (a healthy request clears any prior partial failure streak).
func (b *Breaker) RecordSuccess() {
	b.mu.Lock()
	defer b.mu.Unlock()

	switch b.state {
	case HalfOpen:
		b.state = Closed
		b.consecutiveFails = 0
		b.probeInFlight = false
	case Closed:
		b.consecutiveFails = 0
	}
}

// RecordFailure reports a failed request. In CLOSED, it increments the
// consecutive failure count and trips the breaker to OPEN once the
// configured threshold is reached. In HALF-OPEN, any probe failure sends
// the breaker back to OPEN immediately.
func (b *Breaker) RecordFailure() {
	b.mu.Lock()
	defer b.mu.Unlock()

	switch b.state {
	case HalfOpen:
		b.state = Open
		b.openedAt = time.Now()
		b.probeInFlight = false
		b.consecutiveFails = 0
	case Closed:
		b.consecutiveFails++
		if b.consecutiveFails >= b.opts.FailureThreshold {
			b.state = Open
			b.openedAt = time.Now()
			b.consecutiveFails = 0
		}
	}
}
