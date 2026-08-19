type Props = {
  /** 0..1; values above 1 are clamped. Null renders an empty gauge. */
  ratio: number | null
  centerValue: string
  centerSub: string
  size?: number
  thickness?: number
}

/** Semi-circular usage gauge for the rate-limiting panel. */
export function Gauge({ ratio, centerValue, centerSub, size = 176, thickness = 14 }: Props) {
  const r = (size - thickness) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  // Use 75% of the circle, starting bottom-left, like a dial.
  const arcFraction = 0.75
  const arcLen = circumference * arcFraction

  const clamped = ratio === null ? 0 : Math.max(0, Math.min(1, ratio))
  const filled = arcLen * clamped

  const color = clamped >= 0.9 ? '#ef4444' : clamped >= 0.7 ? '#f59e0b' : '#2563eb'

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="gauge">
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#eef1f6"
        strokeWidth={thickness}
        strokeDasharray={`${arcLen} ${circumference - arcLen}`}
        strokeLinecap="round"
        transform={`rotate(135 ${cx} ${cy})`}
      />
      {ratio !== null && (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeDasharray={`${filled} ${circumference - filled}`}
          strokeLinecap="round"
          transform={`rotate(135 ${cx} ${cy})`}
        />
      )}
      <text x={cx} y={cy + 2} className="gauge-value" textAnchor="middle">
        {centerValue}
      </text>
      <text x={cx} y={cy + 24} className="gauge-sub" textAnchor="middle">
        {centerSub}
      </text>
    </svg>
  )
}
