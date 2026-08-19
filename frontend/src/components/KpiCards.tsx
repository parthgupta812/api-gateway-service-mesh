import type { DashboardData } from '../hooks/useDashboardData'
import { fmtCompact, fmtMillisFromSeconds, fmtPercent, fmtRate } from '../lib/format'
import { Sparkline } from './charts/Sparkline'
import { IconActivity, IconClock, IconDatabase, IconFilter, IconShield } from './Icons'

type Kpi = {
  label: string
  value: string
  icon: JSX.Element
  tone: string
  color: string
  points: { t: number; v: number }[]
  hint: string
}

export function KpiCards({ data }: { data: DashboardData }) {
  const kpis: Kpi[] = [
    {
      label: 'Requests / sec',
      value: fmtRate(data.requestsPerSec),
      icon: <IconActivity size={18} />,
      tone: 'tone-blue',
      color: '#2563eb',
      points: data.rpsSeries,
      hint: 'rate(gateway_http_requests_total)',
    },
    {
      label: 'P95 Latency',
      value: fmtMillisFromSeconds(data.p95Seconds),
      icon: <IconClock size={18} />,
      tone: 'tone-green',
      color: '#10b981',
      points: data.p95Series,
      hint: 'histogram_quantile(0.95, request duration)',
    },
    {
      label: 'Error Rate (5xx)',
      value: fmtPercent(data.errorRate),
      icon: <IconShield size={18} />,
      tone: 'tone-amber',
      color: '#f59e0b',
      points: data.errorSeries,
      hint: '5xx share of all requests',
    },
    {
      label: 'Rate Limited',
      value: fmtCompact(data.rateLimitedTotal),
      icon: <IconFilter size={18} />,
      tone: 'tone-violet',
      color: '#8b5cf6',
      points: data.rateLimitedSeries,
      hint: 'gateway_rate_limited_requests_total',
    },
    {
      label: 'Total Requests',
      value: fmtCompact(data.totalRequests),
      icon: <IconDatabase size={18} />,
      tone: 'tone-slate',
      color: '#64748b',
      points: data.totalSeries,
      hint: 'sum(gateway_http_requests_total)',
    },
  ]

  return (
    <div className="kpi-row">
      {kpis.map((k) => (
        <div className="card kpi-card" key={k.label} title={k.hint}>
          <span className={`kpi-icon ${k.tone}`}>{k.icon}</span>
          <div className="kpi-body">
            <span className="kpi-label">{k.label}</span>
            <span className="kpi-value">{k.value}</span>
          </div>
          <Sparkline points={k.points} color={k.color} />
        </div>
      ))}
    </div>
  )
}
