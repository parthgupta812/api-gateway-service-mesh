# syntax=docker/dockerfile:1

# ---- build stage ----
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

# ---- serve stage ----
FROM nginx:1.27-alpine

# nginx's official image auto-substitutes ${VAR} placeholders in any file
# under /etc/nginx/templates/*.template into /etc/nginx/conf.d/*.conf at
# container startup (docker-entrypoint.d/20-envsubst-on-templates.sh).
# This lets the same image proxy to different gateway/Prometheus hosts
# locally vs. on Render without a rebuild -- just different env vars.
#
# Defaults below reproduce the exact local docker-compose behavior
# (http://gateway:8080, http://prometheus:9090) when no env vars are set,
# so `docker compose up` needs no changes.
ENV GATEWAY_UPSTREAM=http://gateway:8080
ENV PROMETHEUS_UPSTREAM=http://prometheus:9090

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
