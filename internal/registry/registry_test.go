package registry

import (
	"sync"
	"testing"
)

func TestRegistry_RoundRobinDistribution(t *testing.T) {
	reg := New([]string{"http://a:1", "http://b:2", "http://c:3"})

	seen := map[string]int{}
	for i := 0; i < 9; i++ {
		inst := reg.Next()
		if inst == nil {
			t.Fatal("expected an instance, got nil")
		}
		seen[inst.Addr]++
	}

	for _, addr := range []string{"http://a:1", "http://b:2", "http://c:3"} {
		if seen[addr] != 3 {
			t.Errorf("expected addr %s to be selected 3 times, got %d", addr, seen[addr])
		}
	}
}

func TestRegistry_SkipsUnhealthyInstances(t *testing.T) {
	reg := New([]string{"http://a:1", "http://b:2", "http://c:3"})

	// Mark "b" unhealthy.
	for _, inst := range reg.Instances() {
		if inst.Addr == "http://b:2" {
			inst.SetHealthy(false)
		}
	}

	for i := 0; i < 10; i++ {
		inst := reg.Next()
		if inst == nil {
			t.Fatal("expected an instance, got nil")
		}
		if inst.Addr == "http://b:2" {
			t.Fatalf("unhealthy instance should never be selected, got %s", inst.Addr)
		}
	}
}

func TestRegistry_ReturnsNilWhenAllUnhealthy(t *testing.T) {
	reg := New([]string{"http://a:1"})
	reg.Instances()[0].SetHealthy(false)

	if inst := reg.Next(); inst != nil {
		t.Fatalf("expected nil when no healthy instances exist, got %v", inst)
	}
}

func TestRegistry_ReallowsInstanceAfterRecovery(t *testing.T) {
	reg := New([]string{"http://a:1", "http://b:2"})
	instances := reg.Instances()
	var b *Instance
	for _, inst := range instances {
		if inst.Addr == "http://b:2" {
			b = inst
		}
	}

	b.SetHealthy(false)
	for i := 0; i < 4; i++ {
		if inst := reg.Next(); inst.Addr == "http://b:2" {
			t.Fatal("instance b should be excluded while unhealthy")
		}
	}

	b.SetHealthy(true)

	seenB := false
	for i := 0; i < 4; i++ {
		if inst := reg.Next(); inst.Addr == "http://b:2" {
			seenB = true
		}
	}
	if !seenB {
		t.Fatal("expected instance b to be selected again after recovering")
	}
}

// TestRegistry_ConcurrentAccessIsRaceFree hammers Next() and SetHealthy()
// concurrently to be exercised under `go test -race`.
func TestRegistry_ConcurrentAccessIsRaceFree(t *testing.T) {
	reg := New([]string{"http://a:1", "http://b:2", "http://c:3"})

	var wg sync.WaitGroup

	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			reg.Next()
		}()
	}

	for _, inst := range reg.Instances() {
		wg.Add(1)
		go func(inst *Instance) {
			defer wg.Done()
			inst.SetHealthy(true)
			inst.Healthy()
		}(inst)
	}

	wg.Wait()
}
