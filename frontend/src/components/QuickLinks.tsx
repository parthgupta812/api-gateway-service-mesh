import { Link } from 'react-router-dom'
import { IconArrowRight, IconChart, IconExternal, IconHeart, IconList, IconPlay } from './Icons'

/**
 * Falls back to the browser's own host on a given port when no explicit
 * URL is configured -- this is what makes local dev/Docker Compose work
 * with zero configuration (dashboard, gateway, Prometheus and Grafana all
 * share one hostname, just different ports).
 */
function hostUrl(port: number, path = ''): string {
  const { protocol, hostname } = window.location
  return `${protocol}//${hostname}:${port}${path}`
}

const LOCAL_GATEWAY_PORT = 8081
const LOCAL_PROMETHEUS_PORT = 9090
const LOCAL_GRAFANA_PORT = 3000

/**
 * Public deployments (e.g. Render) don't share a single hostname across
 * services, so their real URLs must come from build-time env vars rather
 * than being derived from window.location. These are read via Vite's
 * import.meta.env, which only exposes variables prefixed VITE_ and inlines
 * them at build time -- see frontend/.env.example for the variable names.
 *
 * Locally these are simply unset, so hostUrl()'s same-host-different-port
 * fallback below is used instead, preserving the existing local behavior
 * exactly.
 */
const PUBLIC_GATEWAY_URL = import.meta.env.VITE_GATEWAY_PUBLIC_URL || ''
const PUBLIC_PROMETHEUS_URL = import.meta.env.VITE_PROMETHEUS_PUBLIC_URL || ''
const GRAFANA_DEPLOYED_PUBLICLY = import.meta.env.VITE_GRAFANA_PUBLIC_URL || ''

export function QuickLinks() {
  const gatewayUrl = PUBLIC_GATEWAY_URL || hostUrl(LOCAL_GATEWAY_PORT)
  const prometheusUrl = PUBLIC_PROMETHEUS_URL || hostUrl(LOCAL_PROMETHEUS_PORT)
  // Grafana is intentionally local-only in the public deployment (see
  // README "Public Deployment" section). If VITE_GRAFANA_PUBLIC_URL is
  // ever set for a future deployment, the link activates automatically;
  // otherwise it's shown as a disabled, clearly-labeled local-only entry
  // rather than a broken or misleading link.
  const grafanaUrl = GRAFANA_DEPLOYED_PUBLICLY || hostUrl(LOCAL_GRAFANA_PORT)
  const grafanaIsLocalOnly = !GRAFANA_DEPLOYED_PUBLICLY && !!PUBLIC_GATEWAY_URL

  const links = [
    {
      title: grafanaIsLocalOnly ? 'Grafana Dashboard (local only)' : 'Grafana Dashboard',
      sub: grafanaIsLocalOnly
        ? 'Not publicly deployed — run docker compose locally'
        : 'Detailed metrics & visualization',
      href: `${grafanaUrl}/d/api-gateway-overview`,
      icon: <IconChart size={16} />,
      tone: 'tone-amber',
      disabled: grafanaIsLocalOnly,
    },
    {
      title: 'Prometheus',
      sub: 'Metrics explorer',
      href: `${prometheusUrl}/graph`,
      icon: <IconExternal size={16} />,
      tone: 'tone-red',
    },
    {
      title: 'Gateway Health',
      sub: '/health endpoint',
      href: `${gatewayUrl}/health`,
      icon: <IconHeart size={16} />,
      tone: 'tone-green',
    },
  ]

  return (
    <section className="card">
      <div className="card-head">
        <div className="card-head-left">
          <h2>Quick Links</h2>
        </div>
      </div>

      <ul className="link-list">
        <li>
          <Link to="/playground">
            <span className="link-icon tone-blue">
              <IconPlay size={16} />
            </span>
            <span className="link-body">
              <span className="link-title">API Playground</span>
              <span className="link-sub">Send real requests to the gateway</span>
            </span>
            <IconArrowRight size={16} className="link-arrow" />
          </Link>
        </li>
        <li>
          <Link to="/endpoints">
            <span className="link-icon tone-slate">
              <IconList size={16} />
            </span>
            <span className="link-body">
              <span className="link-title">API Documentation</span>
              <span className="link-sub">Gateway routes reference</span>
            </span>
            <IconArrowRight size={16} className="link-arrow" />
          </Link>
        </li>
        {links.map((l) =>
          l.disabled ? (
            <li key={l.title}>
              <span className="link-list-disabled">
                <span className={`link-icon ${l.tone}`}>{l.icon}</span>
                <span className="link-body">
                  <span className="link-title">{l.title}</span>
                  <span className="link-sub">{l.sub}</span>
                </span>
              </span>
            </li>
          ) : (
            <li key={l.title}>
              <a href={l.href} target="_blank" rel="noreferrer">
                <span className={`link-icon ${l.tone}`}>{l.icon}</span>
                <span className="link-body">
                  <span className="link-title">{l.title}</span>
                  <span className="link-sub">{l.sub}</span>
                </span>
                <IconArrowRight size={16} className="link-arrow" />
              </a>
            </li>
          ),
        )}
      </ul>
    </section>
  )
}
