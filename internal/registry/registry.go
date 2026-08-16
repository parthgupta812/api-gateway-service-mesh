// Package registry provides a small, thread-safe service registry that
// tracks backend instances for a logical service (e.g. "order") and
// selects among the healthy ones using round-robin.
package registry

import (
	"sync"
	"time"

	"apigateway/internal/circuitbreaker"
)

// Instance represents a single backend instance (a Docker Compose service
// name/host plus port), e.g. "order-service-1:9002".
type Instance struct {
	// Addr is the base URL of the instance, e.g. "http://order-service-1:9002".
	Addr string

	// Breaker tracks upstream failures for this instance independently of
	// the health checker. It is never nil.
	Breaker *circuitbreaker.Breaker

	mu      sync.RWMutex
	healthy bool
}

// Healthy reports whether the instance is currently considered healthy by
// the health checker. This is independent of the circuit breaker's state;
// see IsAvailable for the combined view used for routing decisions.
func (i *Instance) Healthy() bool {
	i.mu.RLock()
	defer i.mu.RUnlock()
	return i.healthy
}

// SetHealthy updates the instance's health state, as determined by the
// background health checker.
func (i *Instance) SetHealthy(healthy bool) {
	i.mu.Lock()
	defer i.mu.Unlock()
	i.healthy = healthy
}

// IsAvailable reports whether the instance should currently receive
// traffic: it must be marked healthy by the health checker AND its
// circuit breaker must allow the request (CLOSED, or HALF-OPEN offering a
// probe slot).
func (i *Instance) IsAvailable() bool {
	if !i.Healthy() {
		return false
	}
	return i.Breaker.Allow()
}

// CircuitBreakerOptions configures the circuit breaker attached to every
// instance created via New.
type CircuitBreakerOptions = circuitbreaker.Options

// Registry holds the set of instances for a single logical service and
// selects among the healthy ones in round-robin order. All methods are
// safe for concurrent use.
type Registry struct {
	mu        sync.Mutex
	instances []*Instance
	next      uint64
}

// New creates a registry for the given backend addresses using default
// circuit breaker settings. All instances start out marked healthy so
// they can serve traffic immediately; the health checker will mark any
// that fail probes as unhealthy.
func New(addrs []string) *Registry {
	return NewWithBreakerOptions(addrs, circuitbreaker.Options{
		FailureThreshold: 5,
		RecoveryTimeout:  30 * time.Second,
	})
}

// NewWithBreakerOptions creates a registry like New, but with explicit
// circuit breaker configuration applied to every instance.
func NewWithBreakerOptions(addrs []string, breakerOpts circuitbreaker.Options) *Registry {
	instances := make([]*Instance, 0, len(addrs))
	for _, addr := range addrs {
		instances = append(instances, &Instance{
			Addr:    addr,
			healthy: true,
			Breaker: circuitbreaker.New(breakerOpts),
		})
	}
	return &Registry{instances: instances}
}

// Instances returns all instances registered for this service, healthy or
// not. Useful for health checking.
func (r *Registry) Instances() []*Instance {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]*Instance, len(r.instances))
	copy(out, r.instances)
	return out
}

// Next returns the next available instance using round-robin selection,
// or nil if no instance is currently available. An instance is available
// when it is marked healthy by the health checker and its circuit
// breaker permits the request (see Instance.IsAvailable).
func (r *Registry) Next() *Instance {
	r.mu.Lock()
	defer r.mu.Unlock()

	total := len(r.instances)
	if total == 0 {
		return nil
	}

	for i := 0; i < total; i++ {
		idx := int(r.next % uint64(total))
		r.next++
		candidate := r.instances[idx]
		if candidate.IsAvailable() {
			return candidate
		}
	}
	return nil
}
