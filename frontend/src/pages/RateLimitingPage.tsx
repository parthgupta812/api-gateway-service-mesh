import { useDashboard } from '../context/DashboardContext'
import { Page } from '../components/Page'
import { AreaChart } from '../components/charts/AreaChart'
import { Gauge } from '../components/charts/Gauge'
import { NA, fmtCompact } from '../lib/format'

export default function RateLimitingPage() {
  const { data, range } = useDashboard()
  const cfg = data.topology?.config
  const limit = data.rateLimitHeaders.limit ?? cfg?.rateLimitRequests ?? null
  const remaining = data.rateLimitHeaders.remaining
  const used = limit !== null && remaining !== null ? Math.max(0, limit - remaining) : null
  const windowSeconds = cfg?.rateLimitWindowSeconds ?? null
  const ratio = limit !== null && used !== null && limit > 0 ? used / limit : null

  return (
    <Page title="Rate Limiting" subtitle="Redis-backed per-client request limits">
      <div className="grid grid-main">
        <section className="card">
          <div className="card-head">
            <div className="card-head-left">
              <h2>Current usage</h2>
            </div>
            <span className="pill pill-muted">Per client IP</span>
          </div>
          <div className="ratelimit-body">
            <Gauge ratio={ratio} centerValue={used !== null && limit !== null ? `${used} / ${limit}` : NA} centerSub="Requests" />
            <dl className="stat-list">
              <div>
                <dt>Configured limit</dt>
                <dd>{limit !== null && windowSeconds !== null ? `${limit} req / ${windowSeconds}s` : NA}</dd>
              </div>
              <div>
                <dt>Window</dt>
                <dd>{windowSeconds !== null ? `${windowSeconds} seconds` : NA}</dd>
              </div>
              <div>
                <dt>Used (this client)</dt>
                <dd className="val-blue">{used !== null ? `${used} requests` : NA}</dd>
              </div>
              <div>
                <dt>Remaining (this client)</dt>
                <dd className="val-green">{remaining !== null ? `${remaining} requests` : NA}</dd>
              </div>
              <div>
                <dt>Blocked (all clients, total)</dt>
                <dd className="val-red">{data.rateLimitedTotal !== null ? `${fmtCompact(data.rateLimitedTotal)} requests` : NA}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div className="card-head-left">
              <h2>How it works</h2>
            </div>
          </div>
          <ul className="info-list">
            <li>Each client IP gets an independent counter stored in Redis.</li>
            <li>Counting uses an atomic Redis Lua script, so concurrent requests can&rsquo;t race past the limit.</li>
            <li>The window is fixed: once it expires, the counter resets to zero.</li>
            <li>Requests over the limit receive HTTP 429 with a <code>Retry-After</code> header.</li>
          </ul>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <div className="card-head-left">
            <h2>Rate-limited requests over time</h2>
          </div>
          <span className="pill pill-muted">{range.label}</span>
        </div>
        <AreaChart
          points={data.rateLimitedSeries}
          color="#8b5cf6"
          height={190}
          formatValue={(v) => (v === 0 ? '0' : v < 1 ? v.toFixed(2) : v.toFixed(1))}
          emptyLabel="No requests have been rate-limited in this range"
        />
      </section>
    </Page>
  )
}
