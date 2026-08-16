# API Gateway & Service Mesh Lite

Go/Gin API Gateway with reverse-proxy routing to mock backend services,
Redis-backed rate limiting, round-robin load balancing, health-aware
routing, structured logging, health checks, and graceful shutdown.

## Architecture

```
Client -> Gateway (:8080) -> user-service (:9001)
                           -> order-service-1/2/3 (:9002) [round-robin]
                           -> product-service (:9003)
          Gateway -> Redis (:6379)  [rate limiting]
```

Backend services are tracked in a lightweight service registry per
logical service (e.g. "order"). The gateway probes each instance's
`/health` endpoint on a configurable interval and routes only to
instances currently marked healthy. Each instance also has its own
circuit breaker (CLOSED -> OPEN -> HALF-OPEN) that trips independently
of the health checker on repeated upstream failures.

Prometheus (`:9090`) scrapes gateway metrics from `/metrics`, and Grafana
(`:3000`, admin/admin) is pre-provisioned with a Prometheus datasource and
an "API Gateway Overview" dashboard.

## Run

```
copy .env.example .env
docker compose up -d --build
```

## Verify

```
curl http://localhost:8081/health
curl http://localhost:8081/api/users
curl http://localhost:8081/api/orders
curl http://localhost:8081/api/products
```

Note: the gateway container listens on 8080 internally, but is published on
host port 8081 in `docker-compose.yml` to avoid clashing with other local
services already bound to 8080.

## Local development (without Docker)

```
go mod tidy
go build ./...
go test ./...
```

Run each service in its own terminal:

```
go run ./cmd/user-service
go run ./cmd/order-service
go run ./cmd/product-service
go run ./cmd/gateway
```
