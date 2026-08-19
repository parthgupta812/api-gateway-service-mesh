import type { SeriesPoint } from '../../lib/prometheus'

type Props = {
  points: SeriesPoint[]
  color: string
  width?: number
  height?: number
  fill?: boolean
}

/** Compact trend line for KPI cards. Renders nothing when there is no data. */
export function Sparkline({ points, color, width = 96, height = 34, fill = true }: Props) {
  if (points.length < 2) {
    return <div className="spark-empty" style={{ width, height }} aria-hidden />
  }

  const values = points.map((p) => p.v)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pad = 2

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * (width - pad * 2) + pad
    const y = height - pad - ((p.v - min) / span) * (height - pad * 2)
    return [x, y] as const
  })

  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${coords[coords.length - 1][0].toFixed(1)},${height} L${coords[0][0].toFixed(1)},${height} Z`
  const gradId = `spark-${color.replace(/[^a-z0-9]/gi, '')}`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="spark" role="img" aria-label="trend">
      {fill && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {fill && <path d={area} fill={`url(#${gradId})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
