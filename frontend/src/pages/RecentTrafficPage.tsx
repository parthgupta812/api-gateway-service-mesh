import { useEffect, useMemo, useState } from 'react'
import { useDashboard } from '../context/DashboardContext'
import { Page } from '../components/Page'
import { fetchRecentRequests, type RecentRequest } from '../lib/gateway'
import { NA, fmtClock, statusClass, upstreamName } from '../lib/format'
import { IconSearch } from '../components/Icons'

const STATUS_FILTERS = [
  { label: 'All statuses', value: 'all' },
  { label: '2xx', value: '2xx' },
  { label: '4xx', value: '4xx' },
  { label: '429', value: '429' },
  { label: '5xx', value: '5xx' },
]

function matchesStatusFilter(status: number, filter: string): boolean {
  if (filter === 'all') return true
  if (filter === '429') return status === 429
  if (filter === '2xx') return status >= 200 && status < 300
  if (filter === '4xx') return status >= 400 && status < 500 && status !== 429
  if (filter === '5xx') return status >= 500
  return true
}

/**
 * Full request activity log. Fetches a larger page directly (rather than
 * relying on the shared 25-row snapshot used elsewhere) so filtering has
 * a meaningful amount of history to work with.
 */
export default function RecentTrafficPage() {
  const { refreshMs } = useDashboard()
  const [requests, setRequests] = useState<RecentRequest[]>([])
  const [loading, setLoading] = useState(true)

  const [statusFilter, setStatusFilter] = useState('all')
  const [methodFilter, setMethodFilter] = useState('all')
  const [routeSearch, setRouteSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const rows = await fetchRecentRequests(200)
        if (!cancelled) {
          setRequests(rows)
          setLoading(false)
        }
      } catch {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    if (refreshMs <= 0) return () => {
      cancelled = true
    }
    const id = setInterval(load, refreshMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [refreshMs])

  const methods = useMemo(() => Array.from(new Set(requests.map((r) => r.method))).sort(), [requests])

  const filtered = requests.filter((r) => {
    if (!matchesStatusFilter(r.status, statusFilter)) return false
    if (methodFilter !== 'all' && r.method !== methodFilter) return false
    if (routeSearch.trim() && !r.route.toLowerCase().includes(routeSearch.trim().toLowerCase())) return false
    return true
  })

  return (
    <Page title="Recent Traffic" subtitle="Full request activity log" showRange={false}>
      <section className="card">
        <div className="card-head">
          <div className="card-head-left">
            <h2>Filters</h2>
          </div>
          <span className="card-head-note">
            {filtered.length} of {requests.length} requests
          </span>
        </div>

        <div className="filter-row">
          <label className="select-wrap">
            <span className="sr-only">Status filter</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {STATUS_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>

          <label className="select-wrap">
            <span className="sr-only">Method filter</span>
            <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
              <option value="all">All methods</option>
              {methods.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <div className="search-input-wrap">
            <IconSearch size={15} className="search-icon" />
            <input
              type="text"
              value={routeSearch}
              onChange={(e) => setRouteSearch(e.target.value)}
              placeholder="Search route…"
              className="search-input mono"
            />
          </div>
        </div>
      </section>

      <section className="card">
        {loading ? (
          <p className="empty-note">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="empty-note">
            {requests.length === 0
              ? 'No proxied requests recorded yet — try /api/users, /api/orders or /api/products'
              : 'No requests match the current filters'}
          </p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Method</th>
                  <th>Route</th>
                  <th>Status</th>
                  <th className="ta-right">Latency</th>
                  <th>Upstream</th>
                  <th className="ta-right">Size</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={`${r.time}-${i}`}>
                    <td className="mono subtle">{fmtClock(r.time)}</td>
                    <td>
                      <span className="method-chip">{r.method}</span>
                    </td>
                    <td className="mono">{r.route}</td>
                    <td>
                      <span className={`status-chip ${statusClass(r.status)}`}>{r.status}</span>
                    </td>
                    <td className="ta-right mono">{r.latencyMs} ms</td>
                    <td>
                      {r.upstream ? <span className="upstream-chip">{upstreamName(r.upstream)}</span> : <span className="subtle">{NA}</span>}
                    </td>
                    <td className="ta-right mono subtle">{r.responseSize > 0 ? `${r.responseSize} B` : NA}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Page>
  )
}
