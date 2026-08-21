import { useCallback, useEffect, useRef, useState } from 'react'
import {
  queryRange,
  queryRangeSingle,
  queryScalar,
  queryTargetUp,
  queryVector,
  type Sample,
  type SeriesPoint,
} from '../lib/prometheus'
import { fetchRecentRequests, fetchTopology, type RateLimitHeaders, type RecentRequest, type Topology } from '../lib/gateway'

export type TimeRange = { label: string; seconds: number; rateWindow: string; step: number }

export const TIME_RANGES: TimeRange[] = [
  { label: 'Last 5 minutes', seconds: 300, rateWindow: '1m', step: 10 },
  { label: 'Last 15 minutes', seconds: 900, rateWindow: '1m', step: 30 },
  { label: 'Last 1 hour', seconds: 3600, rateWindow: '5m', step: 60 },
  { label: 'Last 6 hours', seconds: 21600, rateWindow: '5m', step: 300 },
]

export type DashboardData = {
  // KPIs
  requestsPerSec: number | null
  p95Seconds: number | null
  errorRate: number | null
  rateLimitedTotal: number | null
  totalRequests: number | null
  activeRequests: number | null
  uptimeSeconds: number | null

  // Sparkline / chart series
  rpsSeries: SeriesPoint[]
  p95Series: SeriesPoint[]
  p50Series: SeriesPoint[]
  errorSeries: SeriesPoint[]
  rateLimitedSeries: SeriesPoint[]
  totalSeries: SeriesPoint[]
  rate2xxSeries: SeriesPoint[]
  rate4xxSeries: SeriesPoint[]
  rate5xxSeries: SeriesPoint[]

  // Status-class totals (absolute counts, all-time)
  count2xx: number | null
  count4xx: number | null
  count5xx: number | null
  count429: number | null
  p50Seconds: number | null

  // Per-service / per-instance breakdowns
  serviceRps: Sample[]
  serviceTotals: Sample[]
  routeAvgLatency: Sample[]
  routeRps: Sample[]
  orderInstanceRps: Sample[]
  orderInstanceTotals: Sample[]
  serviceSparklines: Record<string, SeriesPoint[]>

  // Gateway introspection
  topology: Topology | null
  rateLimitHeaders: RateLimitHeaders
  recentRequests: RecentRequest[]

  // Meta
  prometheusUp: boolean | null
  lastUpdated: Date | null
  loading: boolean
  error: string | null
}

const EMPTY: DashboardData = {
  requestsPerSec: null,
  p95Seconds: null,
  errorRate: null,
  rateLimitedTotal: null,
  totalRequests: null,
  activeRequests: null,
  uptimeSeconds: null,
  rpsSeries: [],
  p95Series: [],
  p50Series: [],
  errorSeries: [],
  rateLimitedSeries: [],
  totalSeries: [],
  rate2xxSeries: [],
  rate4xxSeries: [],
  rate5xxSeries: [],
  count2xx: null,
  count4xx: null,
  count5xx: null,
  count429: null,
  p50Seconds: null,
  serviceRps: [],
  serviceTotals: [],
  routeAvgLatency: [],
  routeRps: [],
  orderInstanceRps: [],
  orderInstanceTotals: [],
  serviceSparklines: {},
  topology: null,
  rateLimitHeaders: { limit: null, remaining: null },
  recentRequests: [],
  prometheusUp: null,
  lastUpdated: null,
  loading: true,
  error: null,
}

export function useDashboardData(range: TimeRange, refreshMs: number) {
  const [data, setData] = useState<DashboardData>(EMPTY)
  const inFlight = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller
    const { signal } = controller

    const w = range.rateWindow

    try {
      const [
        requestsPerSec,
        p95Seconds,
        p50Seconds,
        errorRate,
        rateLimitedTotal,
        totalRequests,
        activeRequests,
        uptimeSeconds,
        prometheusUp,
        serviceRps,
        serviceTotals,
        routeAvgLatency,
        routeRps,
        orderInstanceRps,
        orderInstanceTotals,
        rpsSeries,
        p95Series,
        p50Series,
        errorSeries,
        rateLimitedSeries,
        totalSeries,
        rate2xxSeries,
        rate4xxSeries,
        rate5xxSeries,
        count2xx,
        count4xx,
        count5xx,
        count429,
        serviceSeries,
        gatewayState,
        recentRequests,
      ] = await Promise.all([
        queryScalar(`sum(rate(gateway_http_requests_total[${w}]))`, signal),
        queryScalar(
          `histogram_quantile(0.95, sum(rate(gateway_http_request_duration_seconds_bucket[${w}])) by (le))`,
          signal,
        ),
        queryScalar(
          `histogram_quantile(0.50, sum(rate(gateway_http_request_duration_seconds_bucket[${w}])) by (le))`,
          signal,
        ),
        // `or vector(0)` on the numerator only: a counter that has never
        // been incremented has no series, and for "how many errors have
        // occurred" the truthful answer is zero rather than unknown. The
        // denominator is left bare so that when there is no traffic at all
        // the result is empty and the UI shows N/A instead of a fake 0%.
        queryScalar(
          `(sum(rate(gateway_http_requests_total{status=~"5.."}[${w}])) or vector(0))` +
            ` / sum(rate(gateway_http_requests_total[${w}]))`,
          signal,
        ),
        queryScalar('sum(gateway_rate_limited_requests_total) or vector(0)', signal),
        queryScalar('sum(gateway_http_requests_total)', signal),
        queryScalar('gateway_active_requests', signal),
        queryScalar('time() - process_start_time_seconds{job="gateway"}', signal),
        queryTargetUp(signal),
        queryVector(`sum by (service) (rate(gateway_upstream_requests_total[${w}]))`, signal),
        // Cumulative (non-rate) per-service totals, across all services --
        // this is what Traffic Distribution shows. Distinct from
        // orderInstanceTotals below, which is order-service-only and
        // broken down by upstream instance instead of by service.
        queryVector('sum by (service) (gateway_upstream_requests_total)', signal),
        queryVector(
          `sum by (route) (rate(gateway_http_request_duration_seconds_sum[${w}])) ` +
            `/ sum by (route) (rate(gateway_http_request_duration_seconds_count[${w}]))`,
          signal,
        ),
        queryVector(`sum by (route) (rate(gateway_http_requests_total[${w}]))`, signal),
        queryVector(
          `sum by (upstream) (rate(gateway_upstream_requests_total{service="order"}[${w}]))`,
          signal,
        ),
        queryVector('sum by (upstream) (gateway_upstream_requests_total{service="order"})', signal),
        queryRangeSingle(`sum(rate(gateway_http_requests_total[${w}]))`, range.seconds, range.step, signal),
        queryRangeSingle(
          `histogram_quantile(0.95, sum(rate(gateway_http_request_duration_seconds_bucket[${w}])) by (le))`,
          range.seconds,
          range.step,
          signal,
        ),
        queryRangeSingle(
          `histogram_quantile(0.50, sum(rate(gateway_http_request_duration_seconds_bucket[${w}])) by (le))`,
          range.seconds,
          range.step,
          signal,
        ),
        queryRangeSingle(
          `sum(rate(gateway_http_requests_total{status=~"5.."}[${w}])) or vector(0)`,
          range.seconds,
          range.step,
          signal,
        ),
        queryRangeSingle(
          `sum(rate(gateway_rate_limited_requests_total[${w}])) or vector(0)`,
          range.seconds,
          range.step,
          signal,
        ),
        queryRangeSingle('sum(gateway_http_requests_total)', range.seconds, range.step, signal),
        queryRangeSingle(
          `sum(rate(gateway_http_requests_total{status=~"2.."}[${w}])) or vector(0)`,
          range.seconds,
          range.step,
          signal,
        ),
        queryRangeSingle(
          `sum(rate(gateway_http_requests_total{status=~"4..",status!="429"}[${w}])) or vector(0)`,
          range.seconds,
          range.step,
          signal,
        ),
        queryRangeSingle(
          `sum(rate(gateway_http_requests_total{status=~"5.."}[${w}])) or vector(0)`,
          range.seconds,
          range.step,
          signal,
        ),
        queryScalar('sum(gateway_http_requests_total{status=~"2.."}) or vector(0)', signal),
        queryScalar('sum(gateway_http_requests_total{status=~"4..",status!="429"}) or vector(0)', signal),
        queryScalar('sum(gateway_http_requests_total{status=~"5.."}) or vector(0)', signal),
        queryScalar('sum(gateway_http_requests_total{status="429"}) or vector(0)', signal),
        queryRange(
          `sum by (service) (rate(gateway_upstream_requests_total[${w}]))`,
          range.seconds,
          range.step,
          signal,
        ),
        fetchTopology(signal),
        fetchRecentRequests(25, signal),
      ])

      const serviceSparklines: Record<string, SeriesPoint[]> = {}
      for (const s of serviceSeries) {
        if (s.labels.service) serviceSparklines[s.labels.service] = s.points
      }

      setData({
        requestsPerSec,
        p95Seconds,
        p50Seconds,
        errorRate,
        rateLimitedTotal,
        totalRequests,
        activeRequests,
        uptimeSeconds: uptimeSeconds ?? gatewayState.topology.uptimeSeconds,
        rpsSeries,
        p95Series,
        p50Series,
        errorSeries,
        rateLimitedSeries,
        totalSeries,
        rate2xxSeries,
        rate4xxSeries,
        rate5xxSeries,
        count2xx,
        count4xx,
        count5xx,
        count429,
        serviceRps,
        serviceTotals,
        routeAvgLatency,
        routeRps,
        orderInstanceRps,
        orderInstanceTotals,
        serviceSparklines,
        topology: gatewayState.topology,
        rateLimitHeaders: gatewayState.rateLimit,
        recentRequests,
        prometheusUp,
        lastUpdated: new Date(),
        loading: false,
        error: null,
      })
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setData((prev) => ({
        ...prev,
        loading: false,
        error: (err as Error).message || 'failed to load dashboard data',
      }))
    }
  }, [range])

  useEffect(() => {
    load()
    if (refreshMs <= 0) return
    const id = setInterval(load, refreshMs)
    return () => clearInterval(id)
  }, [load, refreshMs])

  useEffect(() => () => inFlight.current?.abort(), [])

  return { data, reload: load }
}
