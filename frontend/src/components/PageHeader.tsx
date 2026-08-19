import type { ReactNode } from 'react'
import { TIME_RANGES, type TimeRange } from '../hooks/useDashboardData'
import type { Topology } from '../lib/gateway'
import { NA, fmtUptime } from '../lib/format'
import { IconRefresh } from './Icons'

type Props = {
  title: string
  subtitle: string
  topology: Topology | null
  uptimeSeconds: number | null
  prometheusUp: boolean | null
  lastUpdated: Date | null
  loading: boolean
  range: TimeRange
  onRangeChange: (r: TimeRange) => void
  refreshMs: number
  onRefreshMsChange: (ms: number) => void
  onRefresh: () => void
  /** Show the time-range selector; not every page uses windowed queries. */
  showRange?: boolean
  /** Extra controls rendered before the refresh button (e.g. page actions). */
  actions?: ReactNode
}

const REFRESH_OPTIONS = [
  { label: 'Off', ms: 0 },
  { label: '5s', ms: 5000 },
  { label: '10s', ms: 10000 },
  { label: '30s', ms: 30000 },
]

/** Shared header rendered by every routed page, with page-specific title/subtitle. */
export function PageHeader({
  title,
  subtitle,
  topology,
  uptimeSeconds,
  prometheusUp,
  lastUpdated,
  loading,
  range,
  onRangeChange,
  refreshMs,
  onRefreshMsChange,
  onRefresh,
  showRange = true,
  actions,
}: Props) {
  const status = topology?.status ?? null
  const operational = status === 'operational'

  return (
    <header className="header">
      <div className="header-left">
        <h1>{title}</h1>
        <p className="header-sub">{subtitle}</p>
      </div>

      <div className="header-right">
        <div className="header-status">
          <span className={`chip ${status === null ? 'chip-bad' : operational ? 'chip-ok' : 'chip-warn'}`}>
            <span className="chip-dot" />
            {status === null ? 'Gateway unreachable' : operational ? 'Operational' : 'Degraded'}
          </span>
          <span className={`chip ${prometheusUp ? 'chip-ok' : prometheusUp === null ? 'chip-muted' : 'chip-warn'}`}>
            <span className="chip-dot" />
            Prometheus {prometheusUp ? 'up' : prometheusUp === null ? 'unknown' : 'down'}
          </span>
          <span className="header-uptime">
            Uptime <strong>{uptimeSeconds !== null ? fmtUptime(uptimeSeconds) : NA}</strong>
          </span>
        </div>

        <div className="header-controls">
          {actions}

          <label className="select-wrap">
            <span className="sr-only">Auto refresh interval</span>
            <select
              value={refreshMs}
              onChange={(e) => onRefreshMsChange(Number(e.target.value))}
              aria-label="Auto refresh interval"
            >
              {REFRESH_OPTIONS.map((o) => (
                <option key={o.ms} value={o.ms}>
                  Auto: {o.label}
                </option>
              ))}
            </select>
          </label>

          {showRange && (
            <label className="select-wrap">
              <span className="sr-only">Time range</span>
              <select
                value={range.label}
                onChange={(e) => {
                  const next = TIME_RANGES.find((r) => r.label === e.target.value)
                  if (next) onRangeChange(next)
                }}
                aria-label="Time range"
              >
                {TIME_RANGES.map((r) => (
                  <option key={r.label} value={r.label}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <button
            type="button"
            className={`refresh-btn ${loading ? 'is-loading' : ''}`}
            onClick={onRefresh}
            title={lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString()}` : 'Refresh'}
            aria-label="Refresh data"
          >
            <IconRefresh size={16} />
          </button>
        </div>

        <span className="header-updated subtle">
          {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString(undefined, { hour12: false })}` : 'Loading…'}
        </span>
      </div>
    </header>
  )
}
