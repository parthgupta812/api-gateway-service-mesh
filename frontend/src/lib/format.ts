/** Formatting helpers. `null` always renders as "N/A" — never a fake zero. */

export const NA = 'N/A'

export function fmtNumber(v: number | null, digits = 0): string {
  if (v === null || !Number.isFinite(v)) return NA
  return v.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function fmtCompact(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return NA
  if (Math.abs(v) < 1000) return v.toLocaleString(undefined, { maximumFractionDigits: v < 10 ? 2 : 0 })
  if (Math.abs(v) < 1_000_000) return `${(v / 1000).toFixed(v < 10_000 ? 1 : 0)}K`
  return `${(v / 1_000_000).toFixed(2)}M`
}

export function fmtRate(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return NA
  if (v === 0) return '0'
  if (v < 1) return v.toFixed(2)
  if (v < 100) return v.toFixed(1)
  return fmtCompact(v)
}

/** Seconds -> milliseconds string. */
export function fmtMillisFromSeconds(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return NA
  const ms = v * 1000
  if (ms < 10) return `${ms.toFixed(2)} ms`
  return `${ms.toFixed(1)} ms`
}

export function fmtPercent(v: number | null, digits = 2): string {
  if (v === null || !Number.isFinite(v)) return NA
  return `${(v * 100).toFixed(digits)}%`
}

export function fmtUptime(totalSeconds: number | null): string {
  if (totalSeconds === null || !Number.isFinite(totalSeconds) || totalSeconds < 0) return NA
  const s = Math.floor(totalSeconds)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${sec}s`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

export function fmtClock(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return NA
  return d.toLocaleTimeString(undefined, { hour12: false })
}

export function fmtAxisTime(epochSeconds: number): string {
  const d = new Date(epochSeconds * 1000)
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** Short label for an upstream URL: http://order-service-2:9002 -> order-service-2 */
export function upstreamName(addr: string): string {
  if (!addr) return NA
  return addr.replace(/^https?:\/\//, '').split(':')[0]
}

export function statusClass(status: number): string {
  if (status >= 500) return 'status-5xx'
  if (status === 429) return 'status-429'
  if (status >= 400) return 'status-4xx'
  return 'status-2xx'
}
