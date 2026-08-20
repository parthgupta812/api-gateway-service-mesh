#!/bin/sh
# Minimal entrypoint that renders prometheus.yml.template into a real
# config file, then hands off to Prometheus's normal entrypoint.
#
# The prom/prometheus base image is built on busybox (uclibc), which has
# no `envsubst` (that's from gettext, not present) and no package manager
# to install it. `sed`, which busybox does include, is used instead as
# the smallest dependency-free substitution mechanism.
#
# This produces the same config shape as the local
# monitoring/prometheus/prometheus.yml, just with the scrape target and
# scheme taken from the environment instead of hardcoded, so one image
# works against either the local Docker Compose gateway or a public
# deployment's gateway.
set -eu

: "${GATEWAY_SCRAPE_TARGET:=gateway:8080}"
: "${GATEWAY_SCRAPE_SCHEME:=http}"

sed \
    -e "s|\${GATEWAY_SCRAPE_TARGET}|${GATEWAY_SCRAPE_TARGET}|g" \
    -e "s|\${GATEWAY_SCRAPE_SCHEME}|${GATEWAY_SCRAPE_SCHEME}|g" \
    /etc/prometheus/prometheus.yml.template > /etc/prometheus/prometheus.yml

exec /bin/prometheus \
    --config.file=/etc/prometheus/prometheus.yml \
    --storage.tsdb.path=/prometheus \
    --web.console.libraries=/usr/share/prometheus/console_libraries \
    --web.console.templates=/usr/share/prometheus/consoles
