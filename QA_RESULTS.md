# QA Results — Milestone 4

All results below were captured by actually running the commands shown against a live Docker Compose stack on this machine. No numbers were estimated or invented.

## 1. Test suite

```
go test ./...       -> PASS (all packages)
go test -race ./...  -> PASS (all packages), no data races detected
```

Packages and coverage added/verified this milestone:
- `internal/config` — env parsing, defaults, overrides (existing + verified)
- `internal/registry` — round-robin, health exclusion/recovery, concurrency (existing + verified)
- `internal/proxy` — reverse proxy path rewriting, load balancing, circuit breaker integration (existing + verified)
- `internal/ratelimit` — Redis-backed atomic limiter, concurrency safety (existing + verified)
- `internal/circuitbreaker` — full state machine, concurrency (existing + verified)
- `internal/healthcheck` — **new tests added**: marks healthy/unhealthy instances, handles unreachable hosts, stops probing on context cancellation, probes multiple services independently
- `internal/metrics` — **new tests added**: label-to-value mapping, collector registration sanity
- `internal/router` — **new integration test suite added**: full engine wiring exercised end-to-end (fake HTTP backends + miniredis), covering user/product routing, order load balancing, rate-limit 429 behavior, and a full circuit breaker open→reject→recover cycle through the real proxy+registry+breaker stack

No concurrency bugs were found during this milestone's `-race` runs; the existing Milestone 1-3 implementation held up under expanded test coverage.

## 2. Integration tests

Added `internal/router/router_test.go`, which builds the real `router.New()` engine (same code path used by `cmd/gateway`) against fake backend HTTP servers and a miniredis instance, and drives full HTTP requests through it:

| Test | Result |
|---|---|
| User routing reaches user-service, path rewritten correctly | PASS |
| Product routing reaches product-service | PASS |
| Order requests distributed round-robin across 3 fake instances (3/3/3 over 9 requests) | PASS |
| Rate limiter returns 200 for first N requests, 429 after | PASS |
| Circuit breaker: repeated failures open the breaker, traffic reroutes to healthy instance, recovers to closed after timeout and successful probe | PASS |

## 3. Rate-limit concurrency stress test

Tool: `scripts/loadtest` (custom Go load generator, 50 concurrent workers), against `/api/products` with `RATE_LIMIT_REQUESTS=100`, `RATE_LIMIT_WINDOW_SECONDS=60`, Redis flushed beforehand.

```
target: http://localhost:8081/api/products
total requests: 300
concurrency: 50
total duration: 116.64ms
requests/sec: 2572.01
success (2xx): 100
rate-limited (429): 200
client errors (4xx excl. 429): 0
server errors (5xx): 0
transport errors: 0
avg latency: 16.61ms
p95 latency: 72.30ms
```

Exactly 100 requests succeeded and 200 were rejected with 429 — matching the configured limit precisely despite 50-way concurrency, confirming the Redis Lua script's atomicity. Cross-checked against Prometheus metrics scraped from the gateway immediately after:

```
gateway_http_requests_total{route="/api/products",status="200"} 100
gateway_http_requests_total{route="/api/products",status="429"} 200
gateway_rate_limited_requests_total{route="/api/products"} 200
```

Redis container remained healthy throughout (`docker exec redis redis-cli ping` → `PONG`, container status stayed `healthy`).

## 4. Load balancing test

90 requests fired at `/api/orders` with concurrency 10, all 3 order-service instances running. Distribution measured directly from gateway structured logs (`upstream` field), not inferred from code:

```
http://order-service-1:9002   30
http://order-service-2:9002   30
http://order-service-3:9002   30
```

Perfectly even distribution (30/30/30) confirmed via live logs.

## 5. Failure / recovery tests

**Scenario A — stop order-service-2:**
1. Confirmed all 8 containers healthy before the test.
2. `docker stop order-service-2`.
3. Fired 60 requests at `/api/orders` (concurrency 10) — **all 60 succeeded (100%)**, none failed.
4. Verified via logs that traffic split 30/30 between order-service-1 and order-service-3 only; order-service-2 received zero requests.
5. Gateway log confirmed: `"backend health state changed" ... instance=http://order-service-2:9002 healthy=false` within one health-check interval (5s).

**Scenario B — restart order-service-2:**
1. `docker start order-service-2`, waited for its own health check to pass.
2. Fired 90 requests at `/api/orders` — distribution returned to even 30/30/30 across all three instances, confirming automatic rejoin.

**Second backend tested — product-service (single instance, no redundancy):**
1. `docker stop product-service`, fired 20 requests — all 20 correctly returned HTTP 503 with `{"error":"no healthy backend instances available"}` (expected: no failover possible with only one instance).
2. `docker start product-service`, confirmed immediate recovery — subsequent request returned 200 with the expected product-service payload.

## 6. Circuit breaker state transition test

To isolate breaker-driven behavior from the health checker's independent probing (both mechanisms gate routing, per Milestone 3 design), the health-check interval was temporarily raised to 60s and the breaker's recovery timeout lowered to 10s for this specific test only, then both values were restored to their production defaults (5s / 15s) immediately afterward.

Observed transitions, verified via `gateway_circuit_breaker_state` metric and gateway logs against the real `order-service-2` container:

| Transition | How triggered | Result |
|---|---|---|
| CLOSED → OPEN | Stopped order-service-2, fired concurrent requests until 3 consecutive failures recorded | `gateway_circuit_breaker_state{instance="...order-service-2..."} = 2` (open) |
| OPEN rejects requests | Requests sent while open | Confirmed only order-service-1/3 served traffic; order-service-2 never contacted |
| OPEN → HALF-OPEN → OPEN | Waited past recovery timeout while instance still down; one probe request let through, failed | State returned to `2` (open) immediately after the failed probe |
| HALF-OPEN → CLOSED | Restarted order-service-2, waited past recovery timeout, next probe succeeded | `gateway_circuit_breaker_state{...} = 0` (closed); instance rejoined round-robin (verified 30/30/30 distribution again) |

All four required transitions were observed against real Docker containers, not mocks.

## 7. Prometheus / Grafana data flow verification

- `GET /metrics` on the gateway returns valid Prometheus exposition format — verified.
- Prometheus scrape target: `curl http://localhost:9090/api/v1/targets` → `"scrapeUrl":"http://gateway:8080/metrics","health":"up"`.
- Prometheus received live counters: queried `gateway_http_requests_total{route="/health"}` directly against Prometheus's own API and got a real, non-zero value (414) matching actual request volume generated during testing.
- Latency histogram is live: `histogram_quantile(0.95, ...)` against Prometheus returned a real computed value (~4.9ms) for the `/health` route.
- 429s appear in metrics: confirmed `gateway_http_requests_total{status="429"}` and `gateway_rate_limited_requests_total` incremented exactly in line with the rate-limit stress test above.
- Upstream failures appear in metrics: `gateway_upstream_failures_total{service="order"}` incremented to 3 during the circuit breaker test, matching the exact failure count that tripped the breaker.
- Circuit breaker state changes appear in metrics: confirmed live 0 → 2 → 0 transitions on `gateway_circuit_breaker_state` as documented in section 6.
- Grafana → Prometheus data flow: queried Grafana's own datasource proxy API (`/api/datasources/proxy/uid/.../api/v1/query`) with a live `rate(gateway_http_requests_total[1m])` query and got real non-zero results back through Grafana, confirming Grafana can query and render live data, not just that the container is running.
- Grafana provisioning verified via API: the "API Gateway Overview" dashboard and "Prometheus" datasource are both present automatically after a fresh `docker compose up` with no manual setup.

## 8. Concurrent load test

Tool: `scripts/loadtest`, 400 total requests, 100 concurrent workers, against `/health` (rate limit temporarily raised to 5000/60s for this specific test only, then reverted, to measure gateway throughput rather than rate-limiter rejection behavior).

```
total requests: 400
concurrency: 100
total duration: 185.10ms
requests/sec: 2161.05
success (2xx): 400
rate-limited (429): 0
client errors (4xx excl. 429): 0
server errors (5xx): 0
transport errors: 0
avg latency: 39.03ms
p95 latency: 181.47ms
```

All 400 concurrent requests succeeded with zero errors. Note the p95 here (~181ms) reflects client-side wall-clock time under 100-way concurrency on a single machine (connection setup contention included), not pure server-side processing time; Prometheus's own histogram-based p95 for the same window measured server-side latency at ~4.9ms (see section 7), which is the more representative number for gateway processing overhead.

## 9. Resource / stability check

Measured via `docker stats --no-stream` immediately before and after the 400-request concurrent load test:

| Container | Mem before | Mem after | CPU (snapshot after) |
|---|---|---|---|
| gateway | 13.41 MiB | 17.57 MiB | 0.52% |
| redis | 9.08 MiB | 9.15 MiB | 0.86% |
| order-service-1/2/3 | 5–7 MiB each | ~5–7 MiB each | 0.00% |
| product-service | 4.85 MiB | 5.00 MiB | 0.89% |
| user-service | 4.88 MiB | 5.48 MiB | 1.66% |
| prometheus | 26.13 MiB | 28.36 MiB | 0.18% |
| grafana | 67.86 MiB | 67.96 MiB | 0.14% |

Gateway memory grew by ~4MB under load and did not continue climbing afterward. `go_goroutines` metric read 14 after the load test, consistent with the expected baseline (HTTP server + per-instance health-check probe loops), with no unbounded growth observed. `docker compose ps` after every test in this milestone showed all containers continuously `Up ... (healthy)` — no restarts, no crash-loop, no unhealthy transitions attributable to load.

## 10. Regression test

```
go test ./...        -> PASS
go test -race ./...   -> PASS
docker compose down   -> all containers and network removed cleanly
docker compose up -d --build -> all images rebuilt, all containers started
```

Final container status after full rebuild:

```
NAME              STATUS
gateway           healthy
grafana           healthy
order-service-1   healthy
order-service-2   healthy
order-service-3   healthy
product-service   healthy
prometheus        healthy
redis             healthy
user-service      healthy
```

Post-rebuild smoke test of all routes:
```
GET /health        -> {"redis":"ok","status":"ok"}
GET /api/users      -> user-service response, 200
GET /api/orders     -> order-service response, 200
GET /api/products   -> product-service response, 200
```

Graceful shutdown re-verified post-rebuild: `docker stop gateway` produced clean log sequence `"shutdown signal received"` → `"gateway stopped cleanly"`, no abrupt termination.

## Bugs found and fixed

None. Expanded test coverage (healthcheck, metrics, router integration) and all Docker-based failure/recovery/load scenarios in this milestone did not surface any concurrency bugs, race conditions, or functional regressions in the existing Milestone 1-3 implementation. No production code was changed during this milestone — QA activity only added tests and a standalone load-test script (`scripts/loadtest`, not part of the gateway build/runtime).

## Final system status

All Definition of Done criteria for Milestone 4 are met:
- `go test ./...` passes
- `go test -race ./...` passes
- Integration tests pass (router-level end-to-end tests)
- Rate-limit concurrency test passes (exact 100/200 split under 50-way concurrency)
- Load balancing verified with real measured distribution (30/30/30)
- Health-aware routing verified (order-service-2 and product-service failure/recovery scenarios)
- Circuit breaker failure/recovery verified against real containers (all 4 required transitions observed)
- Prometheus scraping verified (target up, real metric values queried)
- Grafana confirmed querying live data through Prometheus (not just "container running")
- Concurrent load test completed (400 requests / 100 concurrency, 0 errors)
- No unexplained container crashes or restarts observed
- Full Docker stack recovered cleanly after `down`/`up --build`
- Final regression tests passed

## Remaining issues

None blocking. One observation worth flagging for future milestones: the rate limiter is applied globally per-client-IP across all routes (including `/health` and `/metrics`), so a client generating heavy traffic against one API route can also get rate-limited on `/health`/`/metrics` checks from the same IP. This is current, intentional Milestone 2 behavior and not a bug, but worth considering if `/health` and `/metrics` should be exempted from rate limiting in a future milestone (e.g. for external monitoring probes hitting the same IP as application traffic).
