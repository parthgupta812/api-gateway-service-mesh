// Thin client over the Prometheus HTTP API.
//
// Every value rendered by the dashboard comes from either this client or
// the gateway's own read-only endpoints. Nothing is synthesised: when a
// series does not exist yet, these helpers return null/[] and the UI shows
// "N/A" rather than inventing a number.

const PROM_BASE = '/api/prom'

export type Sample = { labels: Record<string, string>; value: number }
export type SeriesPoint = { t: number; v: number }
export type Series = { labels: Record<string, string>; points: SeriesPoint[] }

type PromVectorResponse = {
  status: string
  data?: { resultType: string; result: Array<{ metric: Record<string, string>; value: [number, string] }> }
}

type PromMatrixResponse = {
  status: string
  data?: { resultType: string; result: Array<{ metric: Record<string, string>; values: Array<[number, string]> }> }
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`prometheus request failed: ${res.status}`)
  return (await res.json()) as T
}

/** Runs an instant query and returns every matching sample. */
export async function queryVector(query: string, signal?: AbortSignal): Promise<Sample[]> {
  const url = `${PROM_BASE}/api/v1/query?query=${encodeURIComponent(query)}`
  const json = await fetchJson<PromVectorResponse>(url, signal)
  if (json.status !== 'success' || !json.data) return []
  return json.data.result
    .map((r) => ({ labels: r.metric, value: Number(r.value[1]) }))
    .filter((s) => Number.isFinite(s.value))
}

/**
 * Runs an instant query expected to produce a single scalar.
 * Returns null when the series does not exist or is not a finite number,
 * which the UI renders as "N/A".
 */
export async function queryScalar(query: string, signal?: AbortSignal): Promise<number | null> {
  const samples = await queryVector(query, signal)
  if (samples.length === 0) return null
  const v = samples[0].value
  return Number.isFinite(v) ? v : null
}

/** Runs a range query and returns one entry per matching series. */
export async function queryRange(
  query: string,
  rangeSeconds: number,
  stepSeconds: number,
  signal?: AbortSignal,
): Promise<Series[]> {
  const end = Math.floor(Date.now() / 1000)
  const start = end - rangeSeconds
  const url =
    `${PROM_BASE}/api/v1/query_range?query=${encodeURIComponent(query)}` +
    `&start=${start}&end=${end}&step=${stepSeconds}`
  const json = await fetchJson<PromMatrixResponse>(url, signal)
  if (json.status !== 'success' || !json.data) return []
  return json.data.result.map((r) => ({
    labels: r.metric,
    points: r.values
      .map(([t, v]) => ({ t, v: Number(v) }))
      .filter((p) => Number.isFinite(p.v)),
  }))
}

/** Convenience: range query flattened to a single series (first result). */
export async function queryRangeSingle(
  query: string,
  rangeSeconds: number,
  stepSeconds: number,
  signal?: AbortSignal,
): Promise<SeriesPoint[]> {
  const series = await queryRange(query, rangeSeconds, stepSeconds, signal)
  return series.length > 0 ? series[0].points : []
}

/** Reports whether Prometheus is reachable and the gateway target is up. */
export async function queryTargetUp(signal?: AbortSignal): Promise<boolean | null> {
  const v = await queryScalar('up{job="gateway"}', signal)
  if (v === null) return null
  return v === 1
}
