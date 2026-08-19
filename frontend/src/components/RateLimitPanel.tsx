import type { DashboardData } from '../hooks/useDashboardData'
import { NA, fmtCompact } from '../lib/format'
import { Gauge } from './charts/Gauge'

/**
 * Rate limiting panel.
 *
 * Limit / window come from the gateway's effective configuration.
 * Used / remaining come from the X-RateLimit-* headers the gateway returns
 * on this dashboard's own request, i.e. the live Redis counter for this
 * client as the gateway identifies it.
 * Blocked is the global 429 counter from Prometheus.
 */
export function RateLimitPanel({ data }: { data: DashboardData }) {
  const cfg = data.topology?.config
  const limit = data.rateLimitHeaders.limit ?? cfg?.rateLimitRequests ?? null
  const remaining = data.rateLimitHeaders.remaining
  const used = limit !== null && remaining !== null ? Math.max(0, limit - remaining) : null
  const windowSeconds = cfg?.rateLimitWindowSeconds ?? null
  const ratio = limit !== null && used !== null && limit > 0 ? used / limit : null

  return (
    <section className="card ratelimit-card">
      <div className="card-head">
        <div className="card-head-left">
          <h2>Rate Limiting</h2>
        </div>
        <span className="pill pill-muted">Per client IP</span>
      </div>

      <div className="ratelimit-body">
        <Gauge
          ratio={ratio}
          centerValue={used !== null && limit !== null ? `${used} / ${limit}` : NA}
          centerSub="Requests"
        />

        <dl className="stat-list">
          <div>
            <dt>Limit</dt>
            <dd>{limit !== null && windowSeconds !== null ? `${limit} req / ${windowSeconds}s` : NA}</dd>
          </div>
          <div>
            <dt>Window</dt>
            <dd>{windowSeconds !== null ? `${windowSeconds} seconds` : NA}</dd>
          </div>
          <div>
            <dt>Used</dt>
            <dd className="val-blue">{used !== null ? `${used} requests` : NA}</dd>
          </div>
          <div>
            <dt>Remaining</dt>
            <dd className="val-green">{remaining !== null ? `${remaining} requests` : NA}</dd>
          </div>
          <div>
            <dt>Blocked (total)</dt>
            <dd className="val-red">
              {data.rateLimitedTotal !== null ? `${fmtCompact(data.rateLimitedTotal)} requests` : NA}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
