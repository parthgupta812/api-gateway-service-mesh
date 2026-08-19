export type DonutSlice = { label: string; value: number; color: string }

type Props = {
  slices: DonutSlice[]
  centerValue: string
  centerLabel: string
  size?: number
  thickness?: number
}

/** Donut chart used for order-service traffic distribution. */
export function Donut({ slices, centerValue, centerLabel, size = 168, thickness = 26 }: Props) {
  const total = slices.reduce((sum, s) => sum + s.value, 0)
  const r = (size - thickness) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r

  if (total <= 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eef1f6" strokeWidth={thickness} />
        <text x={cx} y={cy - 2} className="donut-value" textAnchor="middle">
          N/A
        </text>
        <text x={cx} y={cy + 16} className="donut-label" textAnchor="middle">
          {centerLabel}
        </text>
      </svg>
    )
  }

  let offset = 0

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eef1f6" strokeWidth={thickness} />
      {slices.map((s) => {
        const fraction = s.value / total
        const dash = fraction * circumference
        const el = (
          <circle
            key={s.label}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={thickness}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        )
        offset += dash
        return el
      })}
      <text x={cx} y={cy - 2} className="donut-value" textAnchor="middle">
        {centerValue}
      </text>
      <text x={cx} y={cy + 16} className="donut-label" textAnchor="middle">
        {centerLabel}
      </text>
    </svg>
  )
}
