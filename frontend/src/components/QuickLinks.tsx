import { Link } from 'react-router-dom'
import { IconArrowRight, IconChart, IconExternal, IconHeart, IconList, IconPlay } from './Icons'

/**
 * Links resolve against the browser's host so they work whether the stack
 * is reached via localhost or another hostname.
 */
function hostUrl(port: number, path = ''): string {
  const { protocol, hostname } = window.location
  return `${protocol}//${hostname}:${port}${path}`
}

const GATEWAY_PORT = 8081
const PROMETHEUS_PORT = 9090
const GRAFANA_PORT = 3000

export function QuickLinks() {
  const links = [
    {
      title: 'Grafana Dashboard',
      sub: 'Detailed metrics & visualization',
      href: hostUrl(GRAFANA_PORT, '/d/api-gateway-overview'),
      icon: <IconChart size={16} />,
      tone: 'tone-amber',
    },
    {
      title: 'Prometheus',
      sub: 'Metrics explorer',
      href: hostUrl(PROMETHEUS_PORT, '/graph'),
      icon: <IconExternal size={16} />,
      tone: 'tone-red',
    },
    {
      title: 'Gateway Health',
      sub: '/health endpoint',
      href: hostUrl(GATEWAY_PORT, '/health'),
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
        {links.map((l) => (
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
        ))}
      </ul>
    </section>
  )
}
