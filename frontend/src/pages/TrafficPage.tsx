import { useDashboard } from '../context/DashboardContext'
import { Page } from '../components/Page'
import { AreaChart } from '../components/charts/AreaChart'
import { MultiAreaChart } from '../components/charts/MultiAreaChart'
import { TopEndpoints } from '../components/TopEndpoints'
import { TrafficDistribution } from '../components/TrafficDistribution'
import { NA, fmtCompact, fmtMillisFromSeconds, fmtPercent, fmtRate } from '../lib/format'

export default function TrafficPage() {
  const { data, range } = useDashboard()

  const statusSeries = [
    { label: '2xx', color: '#10b981', points: data.rate2xxSeries },
    { label: '4xx', color: '#f59e0b', points: data.rate4xxSeries },
    { label: '5xx', color: '#ef4444', points: data.rate5xxSeries },
  ]

  const latencySeries = [
    { label: 'P50', color: '#10b981', points: data.p50Series },
    { label: 'P95', color: '#2563eb', points: data.p95Series },
  ]

  return (
    <Page title="Traffic" subtitle="Gateway traffic and latency">
      <div className="kpi-row kpi-row-4">
        <MiniStat label="Requests / sec" value={fmtRate(data.requestsPerSec)} />
        <MiniStat label="Total Requests" value={fmtCompact(data.totalRequests)} />
        <MiniStat label="P50 Latency" value={fmtMillisFromSeconds(data.p50Seconds)} />
        <MiniStat label="P95 Latency" value={fmtMillisFromSeconds(data.p95Seconds)} />
      </div>

      <div className="kpi-row kpi-row-4">
        <MiniStat label="2xx (total)" value={fmtCompact(data.count2xx)} tone="val-green" />
        <MiniStat label="4xx (total, excl. 429)" value={fmtCompact(data.count4xx)} tone="val-amber" />
        <MiniStat label="5xx (total)" value={fmtCompact(data.count5xx)} tone="val-red" />
        <MiniStat label="Error rate (5xx)" value={fmtPercent(data.errorRate)} tone="val-red" />
      </div>

      <section className="card">
        <div className="card-head">
          <div className="card-head-left">
            <h2>Requests / sec over time</h2>
          </div>
          <span className="pill pill-muted">{range.label}</span>
        </div>
        <AreaChart
          points={data.rpsSeries}
          color="#2563eb"
          height={180}
          formatValue={(v) => v.toFixed(v < 10 ? 1 : 0)}
          emptyLabel="No traffic in this range"
        />
      </section>

      <div className="grid grid-two">
        <section className="card">
          <div className="card-head">
            <div className="card-head-left">
              <h2>Latency (P50 / P95)</h2>
            </div>
            <span className="card-head-note">Milliseconds</span>
          </div>
          <MultiAreaChart
            series={latencySeries}
            height={190}
            formatValue={(v) => `${(v * 1000).toFixed(v * 1000 < 10 ? 1 : 0)}`}
            emptyLabel="No latency samples in this range"
          />
          <div className="legend-inline">
            {latencySeries.map((s) => (
              <span key={s.label} className="legend-inline-item">
                <span className="legend-dot" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div className="card-head-left">
              <h2>Status classes over time</h2>
            </div>
            <span className="card-head-note">Requests / sec</span>
          </div>
          <MultiAreaChart
            series={statusSeries}
            height={190}
            formatValue={(v) => (v === 0 ? '0' : v < 1 ? v.toFixed(2) : v.toFixed(1))}
            emptyLabel="No traffic in this range"
          />
          <div className="legend-inline">
            {statusSeries.map((s) => (
              <span key={s.label} className="legend-inline-item">
                <span className="legend-dot" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-two">
        <TopEndpoints routeRps={data.routeRps} />
        <TrafficDistribution data={data} rangeLabel={range.label} />
      </div>
    </Page>
  )
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="card mini-stat">
      <span className="kpi-label">{label}</span>
      <span className={`kpi-value kpi-value-sm ${tone ?? ''}`}>{value ?? NA}</span>
    </div>
  )
}
