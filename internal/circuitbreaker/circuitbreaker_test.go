package circuitbreaker

import (
	"sync"
	"testing"
	"time"
)

func TestBreaker_StartsClosed(t *testing.T) {
	b := New(Options{FailureThreshold: 3, RecoveryTimeout: 50 * time.Millisecond})
	if b.State() != Closed {
		t.Fatalf("expected initial state Closed, got %v", b.State())
	}
	if !b.Allow() {
		t.Fatal("expected Allow to return true when Closed")
	}
}

func TestBreaker_ClosedToOpen_OnThresholdFailures(t *testing.T) {
	b := New(Options{FailureThreshold: 3, RecoveryTimeout: time.Minute})

	b.RecordFailure()
	b.RecordFailure()
	if b.State() != Closed {
		t.Fatalf("expected still Closed after 2 failures below threshold, got %v", b.State())
	}

	b.RecordFailure() // 3rd failure hits threshold
	if b.State() != Open {
		t.Fatalf("expected Open after reaching failure threshold, got %v", b.State())
	}
}

func TestBreaker_SuccessResetsFailureCount(t *testing.T) {
	b := New(Options{FailureThreshold: 3, RecoveryTimeout: time.Minute})

	b.RecordFailure()
	b.RecordFailure()
	b.RecordSuccess() // resets count
	b.RecordFailure()
	b.RecordFailure()

	if b.State() != Closed {
		t.Fatalf("expected Closed since failure count was reset by success, got %v", b.State())
	}
}

func TestBreaker_OpenRejectsRequests(t *testing.T) {
	b := New(Options{FailureThreshold: 1, RecoveryTimeout: time.Minute})
	b.RecordFailure() // trips to Open

	if b.State() != Open {
		t.Fatalf("expected Open, got %v", b.State())
	}
	if b.Allow() {
		t.Fatal("expected Allow to return false while Open")
	}
}

func TestBreaker_OpenToHalfOpen_AfterRecoveryTimeout(t *testing.T) {
	b := New(Options{FailureThreshold: 1, RecoveryTimeout: 20 * time.Millisecond})
	b.RecordFailure() // trips to Open

	if b.Allow() {
		t.Fatal("expected Allow false immediately after opening")
	}

	time.Sleep(30 * time.Millisecond)

	if b.State() != HalfOpen {
		t.Fatalf("expected HalfOpen after recovery timeout elapsed, got %v", b.State())
	}
}

func TestBreaker_HalfOpenToClosed_OnSuccessfulProbe(t *testing.T) {
	b := New(Options{FailureThreshold: 1, RecoveryTimeout: 10 * time.Millisecond})
	b.RecordFailure() // Open
	time.Sleep(15 * time.Millisecond)

	if !b.Allow() {
		t.Fatal("expected HalfOpen probe to be allowed")
	}
	b.RecordSuccess()

	if b.State() != Closed {
		t.Fatalf("expected Closed after successful probe, got %v", b.State())
	}
	if !b.Allow() {
		t.Fatal("expected Allow true after closing")
	}
}

func TestBreaker_HalfOpenToOpen_OnFailedProbe(t *testing.T) {
	b := New(Options{FailureThreshold: 1, RecoveryTimeout: 10 * time.Millisecond})
	b.RecordFailure() // Open
	time.Sleep(15 * time.Millisecond)

	if !b.Allow() {
		t.Fatal("expected HalfOpen probe to be allowed")
	}
	b.RecordFailure()

	if b.State() != Open {
		t.Fatalf("expected Open after failed probe, got %v", b.State())
	}
	if b.Allow() {
		t.Fatal("expected Allow false immediately after re-opening")
	}
}

func TestBreaker_HalfOpenOnlyAllowsSingleProbe(t *testing.T) {
	b := New(Options{FailureThreshold: 1, RecoveryTimeout: 10 * time.Millisecond})
	b.RecordFailure() // Open
	time.Sleep(15 * time.Millisecond)

	// First Allow call transitions to HalfOpen and claims the probe slot.
	if !b.Allow() {
		t.Fatal("expected first probe to be allowed")
	}
	// Second call while probe is in flight must be rejected.
	if b.Allow() {
		t.Fatal("expected second concurrent call to be rejected while probe in flight")
	}
}

func TestBreaker_ConfigurableThresholdsAndTimeouts(t *testing.T) {
	b := New(Options{FailureThreshold: 5, RecoveryTimeout: 5 * time.Millisecond})

	for i := 0; i < 4; i++ {
		b.RecordFailure()
	}
	if b.State() != Closed {
		t.Fatalf("expected Closed below custom threshold of 5, got %v", b.State())
	}
	b.RecordFailure()
	if b.State() != Open {
		t.Fatalf("expected Open at custom threshold of 5, got %v", b.State())
	}

	time.Sleep(10 * time.Millisecond)
	if b.State() != HalfOpen {
		t.Fatalf("expected HalfOpen after custom recovery timeout, got %v", b.State())
	}
}

func TestBreaker_DefaultsAppliedForInvalidOptions(t *testing.T) {
	b := New(Options{FailureThreshold: 0, RecoveryTimeout: 0})
	b.RecordFailure()
	if b.State() != Open {
		t.Fatalf("expected threshold to default to >=1, got %v", b.State())
	}
}

// TestBreaker_ConcurrentAccessIsRaceFree hammers Allow/RecordSuccess/
// RecordFailure concurrently to be run under `go test -race`. It doesn't
// assert on the specific end state (that's covered by the tests above)
// but should never panic or produce race warnings, and the breaker must
// end up in a valid, consistent state.
func TestBreaker_ConcurrentAccessIsRaceFree(t *testing.T) {
	b := New(Options{FailureThreshold: 5, RecoveryTimeout: 5 * time.Millisecond})

	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			if b.Allow() {
				if i%2 == 0 {
					b.RecordSuccess()
				} else {
					b.RecordFailure()
				}
			}
		}(i)
	}
	wg.Wait()

	switch b.State() {
	case Closed, Open, HalfOpen:
		// valid state
	default:
		t.Fatalf("breaker ended in invalid state: %v", b.State())
	}
}

// TestBreaker_ConcurrentHalfOpenProbesOnlyOneWins verifies that when many
// goroutines call Allow() simultaneously while HALF-OPEN, exactly one of
// them wins the probe slot.
func TestBreaker_ConcurrentHalfOpenProbesOnlyOneWins(t *testing.T) {
	b := New(Options{FailureThreshold: 1, RecoveryTimeout: 5 * time.Millisecond})
	b.RecordFailure() // Open
	time.Sleep(10 * time.Millisecond)

	var wg sync.WaitGroup
	var mu sync.Mutex
	allowedCount := 0

	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if b.Allow() {
				mu.Lock()
				allowedCount++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()

	if allowedCount != 1 {
		t.Fatalf("expected exactly 1 goroutine to win the half-open probe slot, got %d", allowedCount)
	}
}
