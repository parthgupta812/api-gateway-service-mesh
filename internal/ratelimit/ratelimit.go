// Package ratelimit implements a Redis-backed fixed-window rate limiter.
//
// The limiter uses a single Lua script executed atomically by Redis so
// concurrent requests from the same client cannot race past the limit.
package ratelimit

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// incrementAndExpire atomically increments the counter for a key and, only
// on the first increment within the window, sets its expiry. Doing the
// INCR and EXPIRE in a single script guarantees no other client can read a
// stale count between the two operations.
const incrementAndExpireScript = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
	redis.call("EXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("TTL", KEYS[1])
return {current, ttl}
`

// Limiter enforces a fixed number of requests per client within a
// configurable time window, backed by Redis.
type Limiter struct {
	client *redis.Client
	script *redis.Script
	limit  int
	window time.Duration
}

// Result describes the outcome of a rate limit check for a single request.
type Result struct {
	// Allowed reports whether the request is permitted.
	Allowed bool
	// Limit is the configured maximum requests per window.
	Limit int
	// Remaining is how many requests may still be made in the current window.
	// Never negative.
	Remaining int
	// RetryAfter is how long the client should wait before retrying, only
	// meaningful when Allowed is false.
	RetryAfter time.Duration
}

// New creates a Limiter that allows `limit` requests per `window` duration,
// keyed per client, using client for storage.
func New(client *redis.Client, limit int, window time.Duration) *Limiter {
	return &Limiter{
		client: client,
		script: redis.NewScript(incrementAndExpireScript),
		limit:  limit,
		window: window,
	}
}

// Allow atomically checks and consumes one request unit for the given
// client key (e.g. an IP address). It never allows more than `limit`
// requests to succeed within any single window.
func (l *Limiter) Allow(ctx context.Context, clientKey string) (Result, error) {
	redisKey := fmt.Sprintf("ratelimit:%s", clientKey)
	windowSeconds := int(l.window.Seconds())
	if windowSeconds < 1 {
		windowSeconds = 1
	}

	raw, err := l.script.Run(ctx, l.client, []string{redisKey}, windowSeconds).Result()
	if err != nil {
		return Result{}, err
	}

	values, ok := raw.([]interface{})
	if !ok || len(values) != 2 {
		return Result{}, fmt.Errorf("ratelimit: unexpected script result %v", raw)
	}

	count, err := toInt64(values[0])
	if err != nil {
		return Result{}, err
	}
	ttl, err := toInt64(values[1])
	if err != nil {
		return Result{}, err
	}

	remaining := int64(l.limit) - count
	if remaining < 0 {
		remaining = 0
	}

	retryAfter := time.Duration(ttl) * time.Second
	if ttl < 0 {
		retryAfter = l.window
	}

	return Result{
		Allowed:    count <= int64(l.limit),
		Limit:      l.limit,
		Remaining:  int(remaining),
		RetryAfter: retryAfter,
	}, nil
}

func toInt64(v interface{}) (int64, error) {
	switch n := v.(type) {
	case int64:
		return n, nil
	default:
		return 0, fmt.Errorf("ratelimit: expected int64, got %T", v)
	}
}
