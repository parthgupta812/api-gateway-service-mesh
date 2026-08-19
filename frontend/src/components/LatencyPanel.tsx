import type { SeriesPoint } from '../lib/prometheus'
import { AreaChart } from './charts/AreaChart'

export function LatencyPanel({ points, rangeLabel }: { points: SeriesPoint[]; rangeLabel: string }) {
  return (
    <section className="card latency-card" id="latency">
      <div className="card-head">
        <div className="card-head-left">
          <h2>Latency (P95)</h2>
          <span className="pill pill-muted">{rangeLabel}</span>
        </div>
        <span className="card-head-note">Milliseconds</span>
      </div>
      <AreaChart
        points={points}
        color="#2563eb"
        height={172}
        formatValue={(v) => `${(v * 1000).toFixed(v * 1000 < 10 ? 1 : 0)}`}
        emptyLabel="No latency samples in this range — send traffic through the gateway"
      />
    </section>
  )
}
