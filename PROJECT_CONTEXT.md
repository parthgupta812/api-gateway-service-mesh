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

**Milestone 5 — Frontend dashboard (complete)**
- React 18 + Vite 7 + TypeScript dashboard at `frontend/`, served by nginx
  in its own container on host port **8090**.
- Light-theme "cloud infrastructure console" aesthetic: white cards, blue
  accent, soft shadows, service topology as the centerpiece. Deliberately
  distinct from the dark-theme TaskFlow project.
- Panels: header (status/uptime/refresh/time-range), 5 KPI cards with
  sparklines, service topology, rate limiting gauge, P95 latency chart,
  backend services table, circuit breaker table, order-service traffic
  distribution donut, recent traffic, top endpoints, quick links.
- All charts are hand-rolled SVG (no chart library) to keep dependencies
  minimal. Zero npm vulnerabilities.
- nginx reverse-proxies `/api/prom/*` -> prometheus:9090 and `/api/gw/*` ->
  gateway:8080, so the browser makes only same-origin requests (no CORS,
  no direct browser access to backends needed).
- Auto-refreshes (default 5s, configurable/off) so generated traffic is
  visibly reflected.
- Never fabricates data: missing series render as "N/A". The only
  exception is counters that have never been incremented (5xx numerator,
  rate-limited total), where `or vector(0)` is used because "no series"
  genuinely means "zero occurrences" — the denominator is left bare so a
  gateway with no traffic still shows N/A rather than a fake 0%.

Minimal read-only backend additions made for the dashboard (no behavior
change to routing/balancing/limiting/breaking):
- `GET /gateway/topology` — live registry state: per-instance health,
  circuit breaker state/failures/last-state-change, effective config,
  uptime. Needed because Prometheus series for an instance only exist
  after it has served traffic, so health could not be shown reliably.
- `GET /gateway/recent-requests?limit=N` (default 25, buffer capacity 200)
  — recent proxied API requests, from a bounded in-memory ring buffer
  (`internal/telemetry`). This is the only possible source for the
  recent-traffic view; gateway logs go to stdout and are not reachable
  from a browser. Only `/api/*` requests are recorded. Each entry now also
  includes `responseSize` (bytes written, from `c.Writer.Size()`).
- `internal/circuitbreaker`: added `Failures()` and `LastStateChange()`
  accessors, and the consecutive-failure count is no longer zeroed when
  the breaker trips (so the table can show a meaningful failure count).
  Threshold logic is unchanged — the counter still only increments while
  CLOSED and still resets on success/close.
- `internal/metrics`: `gateway_upstream_requests_total` and
  `gateway_upstream_failures_total` gained a per-instance label, and the
  circuit-breaker gauge's `instance` label was renamed. The label is
  called **`upstream`**, not `instance`, because Prometheus reserves
  `instance` for the scrape target and would rewrite it to
  `exported_instance`. This enables real per-instance traffic
  distribution. Grafana dashboard legend updated to match.
- `internal/proxy`: the load-balanced proxy now sets an
  `X-Upstream-Instance` response header (via `httputil.ReverseProxy`'s
  `ModifyResponse`) identifying which backend instance actually served
  each request. Read-only; does not affect the response body or routing.
  Used by the API Playground to show "upstream: order-service-2" etc.

**Milestone 6 — Multi-page frontend routing (complete)**
- Refactored the single-page scroll dashboard into a proper multi-page app
  using `react-router-dom` v7 (client-side routing, no full page reloads).
- Added `context/DashboardContext.tsx`: a single shared polling loop
  (previously local to `App.tsx`) so every page reads the same live data
  without restarting fetches on navigation.
- Routes: `/` (compact overview), `/topology`, `/traffic`, `/services`,
  `/circuit-breakers`, `/rate-limiting`, `/endpoints`, `/playground`,
  `/recent-traffic`. Unknown paths fall back to `/`.
- `components/Layout.tsx` renders the persistent sidebar (`NavLink`-based,
  active route highlighted) + `<Outlet/>`. `components/Page.tsx` is the
  shared per-page shell (route-specific `PageHeader` + error banner).
- New: **API Playground** (`pages/PlaygroundPage.tsx`) — sends real
  `fetch()` calls through the same `/api/gw/*` nginx proxy the rest of the
  app uses, i.e. genuinely through the running gateway. Supports
  GET/POST/PUT/DELETE, custom headers, JSON body editor with validation,
  and displays status/duration/upstream (from `X-Upstream-Instance`)
  /response headers/formatted JSON body. Nothing is mocked.
- New: **Endpoints page** (`lib/endpoints.ts` static catalog + live
  Prometheus stats per route) with a "Test" button that navigates to
  `/playground?method=X&path=Y` pre-filled.
- New: **Recent Traffic page** — fetches up to 200 requests directly
  (`?limit=200`) and filters client-side by status class, method, and
  route substring search.
- Traffic page gained P50 alongside P95, 2xx/4xx/5xx rate-over-time
  chart (`components/charts/MultiAreaChart.tsx`), and absolute status-class
  totals — all via `or vector(0)` Prometheus queries so a healthy gateway
  with zero errors shows "0", not "N/A" (N/A is reserved for genuinely
  unreachable data sources).
- Existing single-page components (`Topology`, `RateLimitPanel` logic,
  `CircuitBreakerTable`, `BackendServicesTable`, `TrafficDistribution`,
  `RecentTraffic`, `TopEndpoints`, `QuickLinks`, all chart primitives) were
  reused as-is across the new pages, not rewritten — only their scroll-anchor
  `id` attributes were removed since navigation is now route-based.

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
  telemetry/       - bounded ring buffer of recent proxied requests (read-only)
frontend/          - React + Vite + TS dashboard (nginx-served, port 8090)
  src/lib/         - prometheus.ts (PromQL client), gateway.ts (topology/recent), format.ts
  src/hooks/       - useDashboardData.ts (all queries + polling)
  src/components/  - Sidebar, Header, KpiCards, Topology, RateLimitPanel,
                     LatencyPanel, BackendServicesTable, CircuitBreakerTable,
                     TrafficDistribution, RecentTraffic, TopEndpoints,
                     QuickLinks, Icons, charts/{Sparkline,AreaChart,Donut,Gauge}
  nginx.conf       - static serving + /api/prom and /api/gw reverse proxies
  Dockerfile       - node:22-alpine build -> nginx:1.27-alpine serve
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
  load-balanced, rate-limited, circuit-breaker-protected. Responses now
  include an `X-Upstream-Instance` header identifying the serving instance.
- `GET /gateway/topology` — read-only live registry/breaker state (dashboard)
- `GET /gateway/recent-requests?limit=N` — read-only recent proxied requests,
  default limit 25, buffer capacity 200 (dashboard)

## Frontend routes

`/`, `/topology`, `/traffic`, `/services`, `/circuit-breakers`,
`/rate-limiting`, `/endpoints`, `/playground`, `/recent-traffic`. See
Milestone 6 above for what each page shows.

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
- **Dashboard: http://localhost:8090**
- Gateway: http://localhost:8081
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000 (admin/admin)
- Redis: localhost:6379

Frontend local dev (against a running stack): `cd frontend && npm install
&& npm run dev` (Vite dev server proxies to localhost:9090 / localhost:8081).

## Update this file

Whenever a new milestone/phase completes or major architectural decisions
are made, update this file's relevant section so future sessions have
accurate context without re-deriving it from scratch.
