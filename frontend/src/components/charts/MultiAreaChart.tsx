import { useState } from 'react'
import type { SeriesPoint } from '../../lib/prometheus'
import { fmtAxisTime } from '../../lib/format'

export type ChartSeries = { label: string; color: string; points: SeriesPoint[] }

type Props = {
  series: ChartSeries[]
  height?: number
  formatValue: (v: number) => string
  emptyLabel?: string
}

/** Multi-line time-series chart (no fill) for comparing several series, e.g. 2xx/4xx/5xx rates. */
export function MultiAreaChart({ series, height = 200, formatValue, emptyLabel = 'No data in range' }: Props) {
  const [hover, setHover] = useState<number | null>(null)

  const longest = series.reduce((best, s) => (s.points.length > best.length ? s.points : best), [] as SeriesPoint[])
  if (longest.length < 2) {
    return <div className="chart-empty" style={{ height }}>{emptyLabel}</div>
  }

  const W = 720
  const H = height
  const padL = 46
  const padR = 12
  const padT = 12
  const padB = 26

  const allValues = series.flatMap((s) => s.points.map((p) => p.v))
  const rawMax = allValues.length > 0 ? Math.max(...allValues) : 0
  const max = rawMax === 0 ? 1 : rawMax * 1.25
  const min = 0

  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const x = (i: number, len: number) => padL + (i / (len - 1)) * innerW
  const y = (v: number) => padT + innerH - ((v - min) / (max - min)) * innerH

  const ticks = 4
  const gridValues = Array.from({ length: ticks + 1 }, (_, i) => min + ((max - min) * i) / ticks)
  const labelIdx = [0, Math.floor((longest.length - 1) / 3), Math.floor((2 * (longest.length - 1)) / 3), longest.length - 1]

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="area-chart"
        preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const relX = ((e.clientX - rect.left) / rect.width) * W
          const ratio = (relX - padL) / innerW
          const idx = Math.round(ratio * (longest.length - 1))
          setHover(idx >= 0 && idx < longest.length ? idx : null)
        }}
      >
        {gridValues.map((gv, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(gv)} y2={y(gv)} className="grid-line" />
            <text x={padL - 8} y={y(gv) + 3.5} className="axis-label" textAnchor="end">
              {formatValue(gv)}
            </text>
          </g>
        ))}

        {series.map((s) => {
          if (s.points.length < 2) return null
          const line = s.points
            .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i, s.points.length).toFixed(1)},${y(p.v).toFixed(1)}`)
            .join(' ')
          return <path key={s.label} d={line} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        })}

        {labelIdx.map((idx) => (
          <text key={idx} x={x(idx, longest.length)} y={H - 8} className="axis-label" textAnchor="middle">
            {fmtAxisTime(longest[idx].t)}
          </text>
        ))}

        {hover !== null && (
          <line x1={x(hover, longest.length)} x2={x(hover, longest.length)} y1={padT} y2={padT + innerH} className="hover-line" />
        )}
      </svg>

      {hover !== null && (
        <div className="chart-tooltip chart-tooltip-multi" style={{ left: `${((x(hover, longest.length) - padL) / innerW) * 100}%` }}>
          {series.map((s) => {
            const p = s.points[hover]
            return (
              <div key={s.label} className="tooltip-row">
                <span className="tooltip-dot" style={{ background: s.color }} />
                <span>{s.label}</span>
                <strong>{p ? formatValue(p.v) : '–'}</strong>
              </div>
            )
          })}
          <span className="tooltip-time">{fmtAxisTime(longest[hover].t)}</span>
        </div>
      )}
    </div>
  )
}
