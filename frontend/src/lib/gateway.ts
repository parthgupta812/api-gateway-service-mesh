// Client for the gateway's own read-only introspection endpoints.
//
// These provide state that Prometheus cannot: per-instance health as judged
// by the health checker, live circuit breaker state (metric series only
// appear once an instance has served traffic), the gateway's effective
// configuration, and a bounded log of recent proxied requests.

const GW_BASE = '/api/gw'

export type InstanceState = {
  addr: string
  name: string
  healthy: boolean
  circuitState: 'closed' | 'half_open' | 'open' | string
  failures: number
  lastStateChange: string
}

export type ServiceState = {
  key: string
  label: string
  instances: InstanceState[]
  healthy: number
  total: number
}

export type GatewayConfig = {
  rateLimitRequests: number
  rateLimitWindowSeconds: number
  healthCheckIntervalSeconds: number
  circuitBreakerFailureThreshold: number
  circuitBreakerRecoveryTimeoutSeconds: number
}

export type Topology = {
  status: string
  redis: string
  uptimeSeconds: number
  startedAt: string
  services: ServiceState[]
  config: GatewayConfig
}

export type RecentRequest = {
  time: string
  method: string
  route: string
  status: number
  latencyMs: number
  upstream: string
  responseSize: number
}

/**
 * Rate-limit headers the gateway attaches to every response. Reading them
 * off our own request gives the real live counter for this client as the
 * gateway sees it, without needing a dedicated endpoint.
 */
export type RateLimitHeaders = {
  limit: number | null
  remaining: number | null
}

export type TopologyResult = {
  topology: Topology
  rateLimit: RateLimitHeaders
}

export async function fetchTopology(signal?: AbortSignal): Promise<TopologyResult> {
  const res = await fetch(`${GW_BASE}/gateway/topology`, { signal })
  if (!res.ok) throw new Error(`gateway topology request failed: ${res.status}`)

  const limitHeader = res.headers.get('X-RateLimit-Limit')
  const remainingHeader = res.headers.get('X-RateLimit-Remaining')

  return {
    topology: (await res.json()) as Topology,
    rateLimit: {
      limit: limitHeader !== null ? Number(limitHeader) : null,
      remaining: remainingHeader !== null ? Number(remainingHeader) : null,
    },
  }
}

export async function fetchRecentRequests(limit = 25, signal?: AbortSignal): Promise<RecentRequest[]> {
  const res = await fetch(`${GW_BASE}/gateway/recent-requests?limit=${limit}`, { signal })
  if (!res.ok) throw new Error(`recent requests failed: ${res.status}`)
  const json = (await res.json()) as { requests: RecentRequest[] | null }
  return json.requests ?? []
}

/**
 * Sends a real HTTP request through the gateway (same-origin, via the
 * nginx /api/gw proxy) and returns full details for the API Playground.
 * This performs an actual network call — nothing here is simulated.
 */
export type PlaygroundResult = {
  status: number
  statusText: string
  durationMs: number
  upstream: string | null
  headers: Record<string, string>
  bodyText: string
  bodyJson: unknown | null
  error: string | null
}

export async function sendPlaygroundRequest(
  method: string,
  path: string,
  headers: Record<string, string>,
  body: string | null,
): Promise<PlaygroundResult> {
  const url = `${GW_BASE}${path.startsWith('/') ? path : `/${path}`}`
  const start = performance.now()

  try {
    const res = await fetch(url, {
      method,
      headers: body !== null ? { 'Content-Type': 'application/json', ...headers } : headers,
      body: body !== null && method !== 'GET' && method !== 'HEAD' ? body : undefined,
    })
    const durationMs = performance.now() - start

    const responseHeaders: Record<string, string> = {}
    res.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })

    const bodyText = await res.text()
    let bodyJson: unknown | null = null
    try {
      bodyJson = bodyText ? JSON.parse(bodyText) : null
    } catch {
      bodyJson = null
    }

    return {
      status: res.status,
      statusText: res.statusText,
      durationMs,
      upstream: responseHeaders['x-upstream-instance'] ?? null,
      headers: responseHeaders,
      bodyText,
      bodyJson,
      error: null,
    }
  } catch (err) {
    return {
      status: 0,
      statusText: '',
      durationMs: performance.now() - start,
      upstream: null,
      headers: {},
      bodyText: '',
      bodyJson: null,
      error: (err as Error).message || 'Request failed',
    }
  }
}
