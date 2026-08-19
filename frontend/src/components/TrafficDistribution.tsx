import type { DashboardData } from '../hooks/useDashboardData'
import { NA, fmtCompact, upstreamName } from '../lib/format'
import { Donut, type DonutSlice } from './charts/Donut'

const COLORS = ['#2563eb', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444']

/**
 * Order-service traffic distribution, proving load balancing is actually
 * spreading requests. Values come from the per-instance upstream counter
 * (gateway_upstream_requests_total{service="order"}).
 */
export function TrafficDistribution({ data, rangeLabel }: { data: DashboardData; rangeLabel: string }) {
  const totals = data.orderInstanceTotals
    .map((s) => ({ name: upstreamName(s.labels.upstream ?? ''), value: s.value }))
    .filter((s) => s.name !== NA)
    .sort((a, b) => a.name.localeCompare(b.name))

  const grandTotal = totals.reduce((sum, s) => sum + s.value, 0)

  const slices: DonutSlice[] = totals.map((s, i) => ({
    label: s.name,
    value: s.value,
    color: COLORS[i % COLORS.length],
  }))

  return (
    <section className="card">
      <div className="card-head">
        <div className="card-head-left">
          <h2>Traffic Distribution</h2>
          <span className="pill pill-muted">Order Service</span>
        </div>
      </div>

      {slices.length === 0 ? (
        <p className="empty-note">No order-service traffic recorded yet — send requests to /api/orders</p>
      ) : (
        <div className="dist-body">
          <Donut
            slices={slices}
            centerValue={fmtCompact(grandTotal)}
            centerLabel="Total requests"
          />
          <ul className="legend">
            {slices.map((s) => {
              const pct = grandTotal > 0 ? (s.value / grandTotal) * 100 : 0
              return (
                <li key={s.label}>
                  <span className="legend-dot" style={{ background: s.color }} />
                  <span className="legend-label">{s.label}</span>
                  <span className="legend-value">
                    {pct.toFixed(0)}% <span className="subtle">({fmtCompact(s.value)})</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      <div className="card-foot subtle">Cumulative since gateway start · rates over {rangeLabel.toLowerCase()}</div>
    </section>
  )
}
