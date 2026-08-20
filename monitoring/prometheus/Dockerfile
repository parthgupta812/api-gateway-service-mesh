# syntax=docker/dockerfile:1
#
# Deployable Prometheus image for environments (e.g. Render) that cannot
# bind-mount ./monitoring/prometheus/prometheus.yml the way the local
# docker-compose.yml does. This packages the same scrape configuration
# into the image and renders the actual scrape target from environment
# variables at container startup.
#
# Local development is UNAFFECTED: docker-compose.yml continues to run
# the stock prom/prometheus:v2.55.1 image with the existing bind-mounted
# monitoring/prometheus/prometheus.yml, unchanged.

FROM prom/prometheus:v2.55.1

COPY prometheus.yml.template /etc/prometheus/prometheus.yml.template
COPY docker-entrypoint.sh /docker-entrypoint.sh

# prom/prometheus's base image runs as an unprivileged "nobody" user by
# default; the copied files must be readable/executable by it.
USER root
RUN chmod +x /docker-entrypoint.sh
USER nobody

ENTRYPOINT ["/docker-entrypoint.sh"]
