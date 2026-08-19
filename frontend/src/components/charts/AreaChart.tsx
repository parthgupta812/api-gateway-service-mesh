import { useState } from 'react'
import type { SeriesPoint } from '../../lib/prometheus'
import { fmtAxisTime } from '../../lib/format'

type Props = {
  points: SeriesPoint[]
  color?: string
  height?: number
  /** Converts a raw value into the displayed label (e.g. seconds -> ms). */
  formatValue: (v: number) => string
  emptyLabel?: string
}

/**
 * Time-series area chart with gridlines, axis labels and a hover readout.
 * Sized responsively via viewBox so it adapts to the card width.
 */
export function AreaChart({ points, color = '#2563eb', height = 168, formatValue, emptyLabel = 'No data in range' }: Props) {
  const [hover, setHover] = useState<number | null>(null)

  if (points.length < 2) {
    return (
      <div className="chart-empty" style={{ height }}>
        {emptyLabel}
      </div>
    )
  }

  const W = 720
  const H = height
  const padL = 46
  const padR = 12
  const padT = 12
  const padB = 26

  const values = points.map((p) => p.v)
  const rawMax = Math.max(...values)
  const max = rawMax === 0 ? 1 : rawMax * 1.25
  const min = 0

  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const x = (i: number) => padL + (i / (points.length - 1)) * innerW
  const y = (v: number) => padT + innerH - ((v - min) / (max - min)) * innerH

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
  const area = `${line} L${x(points.length - 1).toFixed(1)},${padT + innerH} L${padL},${padT + innerH} Z`

  const ticks = 4
  const gridValues = Array.from({ length: ticks + 1 }, (_, i) => min + ((max - min) * i) / ticks)

  const labelIdx = [0, Math.floor((points.length - 1) / 3), Math.floor((2 * (points.length - 1)) / 3), points.length - 1]

  const hoverPoint = hover !== null ? points[hover] : null

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
          const idx = Math.round(ratio * (points.length - 1))
          setHover(idx >= 0 && idx < points.length ? idx : null)
        }}
      >
        <defs>
          <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.20" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {gridValues.map((gv, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(gv)} y2={y(gv)} className="grid-line" />
            <text x={padL - 8} y={y(gv) + 3.5} className="axis-label" textAnchor="end">
              {formatValue(gv)}
            </text>
          </g>
        ))}

        <path d={area} fill="url(#area-grad)" />
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {labelIdx.map((idx) => (
          <text key={idx} x={x(idx)} y={H - 8} className="axis-label" textAnchor="middle">
            {fmtAxisTime(points[idx].t)}
          </text>
        ))}

        {hover !== null && hoverPoint && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + innerH} className="hover-line" />
            <circle cx={x(hover)} cy={y(hoverPoint.v)} r="4" fill="#fff" stroke={color} strokeWidth="2" />
          </g>
        )}
      </svg>

      {hover !== null && hoverPoint && (
        <div className="chart-tooltip" style={{ left: `${((x(hover) - padL) / innerW) * 100}%` }}>
          <strong>{formatValue(hoverPoint.v)}</strong>
          <span>{fmtAxisTime(hoverPoint.t)}</span>
        </div>
      )}
    </div>
  )
}
