import type { RecentRequest } from '../lib/gateway'
import { NA, fmtClock, statusClass, upstreamName } from '../lib/format'

export function RecentTraffic({ requests, limit = 8 }: { requests: RecentRequest[]; limit?: number }) {
  const rows = requests.slice(0, limit)

  return (
    <section className="card">
      <div className="card-head">
        <div className="card-head-left">
          <h2>Recent Traffic</h2>
        </div>
        <span className="card-head-note">Proxied API requests</span>
      </div>

      {rows.length === 0 ? (
        <p className="empty-note">No proxied requests recorded yet — try /api/users, /api/orders or /api/products</p>
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
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
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
                    {r.upstream ? (
                      <span className="upstream-chip">{upstreamName(r.upstream)}</span>
                    ) : (
                      <span className="subtle">{NA}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
