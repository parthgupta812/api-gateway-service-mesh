# Project Context — API Gateway & Service Mesh Lite

This file exists so context survives across chat sessions. Read this first
in any new session before making changes.

## What this project is

A production-inspired API Gateway built in Go, developed incrementally
across 4 completed milestones, now starting a 5th (frontend dashboard).

## Milestone history (all complete and verified)

**Milestone 1 — Foundation + basic routing**
- Go + Gin gateway, reverse-proxy routing to 3 mock backend services
  (user, order, product)
- Redis connectivity (no rate limiting yet at this stage)
- Structured logging (slog, JSON), health checks, graceful shutdown
- Docker Compose + multi-stage Dockerfile (shared across all 4 Go binaries
  via `BINARY_PATH` build arg)

**Milestone 2 — Gateway resilience and traffic management**
- Redis-backed atomic rate limiting (Lua script, fixed window, per client
  IP), returns 429 with `X-RateLimit-*` / `Retry-After` headers
- Round-robin load balancing across multiple instances of a service
- Service registry abstraction (`internal/registry`) tracking instance
  health
- Health-aware routing: background prober excludes/re-admits instances
- order-service split into 3 replicas: order-service-1/2/3

**Milestone 3 — Resilience + observability**
- Circuit breaker per backend instance (CLOSED → OPEN → HALF-OPEN state
  machine), independent of but coordinated with the health checker
- Prometheus metrics exposed at `/metrics` (requests, latency histogram,
  active requests, upstream failures, rate-limited count, circuit breaker
  state gauge, circuit breaker rejections)
- Prometheus + Grafana added to Docker Compose, both auto-provisioned
  (datasource + one dashboard) via files in `monitoring/`

**Milestone 4 — QA, integration testing, performance validation**
- Expanded test coverage (healthcheck, metrics, full router integration
  tests using fake HTTP backends + miniredis)
- Real Docker-based QA: rate-limit concurrency stress test, load-balancing
  distribution verification, failure/recovery scenarios (stopped/restarted
  order-service-2 and product-service), explicit circuit breaker state
  transition tests, Prometheus/Grafana live data-flow verification,
  concurrent load test, resource stability checks, full regression
- Added `scripts/loadtest` — a small standalone Go load generator (not
  part of the gateway build/runtime) used for QA only
- Results documented in `QA_RESULTS.md` (real measured numbers, no
  invented data)

**Milestone 5 — Frontend dashboard (in progress)**
- Goal: React + Vite dashboard styled as a light-theme "cloud/network
  infrastructure console" (explicitly distinct from a separate dark-theme
  "TaskFlow" project), visualizing the gateway's service topology, live
  Prometheus metrics, rate limiting, circuit breaker states, and traffic
  distribution.
- Must not modify backend architecture. Small read-only integration
  endpoints are allowed if genuinely needed, but avoid changing existing
  behavior.
- Added to Docker Compose as a new service; full stack still starts with
  `docker compose up -d --build`.
- See "Frontend dashboard details" section below once implemented — update
  this file as that work progresses.

## Current architecture

```
Client -> Gateway (Go/Gin, :8080 internal, :8081 host) -> user-service (:9001)
                                                        -> order-service-1/2/3 (:9002) [round-robin + circuit breaker]
                                                        -> product-service (:9003)
          Gateway -> Redis (:6379) [rate limiting]
          Prometheus (:9090) scrapes Gateway /metrics
          Grafana (:3000, admin/admin) queries Prometheus, pre-provisioned dashboard
```

Host port 8081 is used for the gateway (not 8080) because another local
process (Oracle TNSLSNR) already holds port 8080 on this machine.

## Repo structure

```
cmd/
  gateway/main.go            - gateway entrypoint
  user-service/main.go       - mock user service (uses internal/mockservice)
  order-service/main.go      - mock order service (same binary run as 3 replicas)
  product-service/main.go    - mock product service
internal/
  circuitbreaker/  - CLOSED/OPEN/HALF-OPEN state machine, per instance
  config/          - env var config loading, all tunables
  healthcheck/     - background prober, marks registry instances healthy/unhealthy
  logging/         - shared slog JSON logger setup
  metrics/         - Prometheus metric definitions (counters/histograms/gauges)
  middleware/      - Gin middleware: request logging, metrics, rate limiting
  mockservice/      - generic mock backend runner (used by user/order/product cmd)
  proxy/           - reverse proxy + load-balanced proxy (httputil.ReverseProxy based)
  ratelimit/       - Redis Lua-script atomic fixed-window limiter
  registry/        - service registry: round-robin selection + instance health + breaker
  router/          - wires everything into the Gin engine (router.New)
monitoring/
  prometheus/prometheus.yml                    - scrape config (targets gateway:8080/metrics)
  grafana/provisioning/datasources/            - Prometheus datasource (auto-provisioned)
  grafana/provisioning/dashboards/json/        - "API Gateway Overview" dashboard (auto-provisioned)
scripts/
  loadtest/main.go  - standalone QA load generator, not part of gateway runtime
Dockerfile           - shared multi-stage build for all 4 Go binaries (BINARY_PATH arg)
docker-compose.yml   - full stack: redis, user/order(x3)/product services, gateway, prometheus, grafana
.env / .env.example  - environment configuration
QA_RESULTS.md        - Milestone 4 QA results with real measured numbers
README.md            - minimal run instructions
```

## Key configuration (env vars, see .env / .env.example)

- `GATEWAY_PORT=8080` (host-mapped to 8081)
- `REDIS_HOST=redis`, `REDIS_PORT=6379`
- `USER_SERVICE_URL`, `ORDER_SERVICE_URL` (comma-separated for multiple
  instances), `PRODUCT_SERVICE_URL`
- `RATE_LIMIT_REQUESTS=100`, `RATE_LIMIT_WINDOW_SECONDS=60`
- `HEALTH_CHECK_INTERVAL_SECONDS=5`, `HEALTH_CHECK_TIMEOUT_SECONDS=2`, `HEALTH_CHECK_PATH=/health`
- `CIRCUIT_BREAKER_FAILURE_THRESHOLD=3` (compose) / default 5 in code,
  `CIRCUIT_BREAKER_RECOVERY_TIMEOUT_SECONDS=15` (compose) / default 30 in code

## Gateway endpoints

- `GET /health` — gateway + Redis health
- `GET /metrics` — Prometheus exposition format
- `GET /api/users/*`, `GET /api/orders/*`, `GET /api/products/*` — proxied,
  load-balanced, rate-limited, circuit-breaker-protected

## Explicit restrictions carried across all milestones

Do NOT add: authentication/JWT, Kubernetes, Kafka/RabbitMQ, service mesh
frameworks (Consul etc.), distributed tracing, databases, CRUD/user
management, AI features. These are permanently out of scope for this
project unless the user explicitly changes direction.

## Testing conventions

- `go test ./...` and `go test -race ./...` must both pass before/after
  any change.
- Unit tests use `httptest` fake backends and `miniredis` (no real network
  calls in unit tests).
- Docker-based QA verifies real behavior end-to-end (rate limiting, load
  balancing, failure/recovery, circuit breaker transitions) — see
  `QA_RESULTS.md` for the pattern to follow if repeating this.
- After any backend change: rerun `go build ./...`, `go test ./...`,
  `go test -race ./...`, then `docker compose up -d --build` and confirm
  all containers report healthy.

## Notes / gotchas

- Docker healthchecks use `wget -q -O - <url>` (a real GET), not
  `wget --spider` (HEAD) — Gin's `engine.GET(...)` doesn't respond to HEAD
  requests, which caused a false "unhealthy" status in Milestone 1.
- Rate limiting is global per-client-IP across ALL routes including
  `/health` and `/metrics` — a client hammering one API route can get
  itself rate-limited on health checks too. Known, intentional behavior,
  not a bug.
- When testing circuit breaker transitions in isolation, the health
  checker's independent probing can mask breaker-specific state changes
  (both must agree for `IsAvailable()` to return true). Milestone 4 QA
  temporarily raised `HEALTH_CHECK_INTERVAL_SECONDS` during manual testing
  to isolate breaker behavior, then always restored it afterward — do the
  same if repeating this kind of test.

## How to run

```
docker compose up -d --build
```

Then:
- Gateway: http://localhost:8081
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000 (admin/admin)
- Redis: localhost:6379

## Update this file

Whenever a new milestone/phase completes or major architectural decisions
are made, update this file's relevant section so future sessions have
accurate context without re-deriving it from scratch.
