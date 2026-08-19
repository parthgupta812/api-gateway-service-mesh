import type { Sample } from '../lib/prometheus'
import { fmtRate } from '../lib/format'

/** Most active gateway routes, by request rate over the selected window. */
export function TopEndpoints({ routeRps }: { routeRps: Sample[] }) {
  const rows = routeRps
    .map((s) => ({ route: s.labels.route || 'unmatched', value: s.value }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)

  const max = rows.length > 0 ? rows[0].value : 0

  return (
    <section className="card">
      <div className="card-head">
        <div className="card-head-left">
          <h2>Top Endpoints</h2>
        </div>
        <span className="card-head-note">Requests / sec</span>
      </div>

      {rows.length === 0 ? (
        <p className="empty-note">No active routes in this window</p>
      ) : (
        <ul className="bar-list">
          {rows.map((r) => (
            <li key={r.route}>
              <span className="bar-label mono">{r.route}</span>
              <span className="bar-track">
                <span
                  className="bar-fill"
                  style={{ width: max > 0 ? `${Math.max(3, (r.value / max) * 100)}%` : '0%' }}
                />
              </span>
              <span className="bar-value mono">{fmtRate(r.value)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
