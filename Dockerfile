# syntax=docker/dockerfile:1

# Multi-stage build shared by all services in this repo.
# BINARY_PATH selects which cmd/* package to compile
# (e.g. cmd/gateway, cmd/user-service, cmd/order-service, cmd/product-service).

FROM golang:1.23-alpine AS builder
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .

ARG BINARY_PATH=cmd/gateway
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/app ./${BINARY_PATH}

FROM alpine:3.20
RUN apk add --no-cache wget ca-certificates \
    && adduser -D -H appuser
WORKDIR /app
COPY --from=builder /out/app ./app
USER appuser

ENTRYPOINT ["./app"]
