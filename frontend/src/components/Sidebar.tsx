import { NavLink } from 'react-router-dom'
import type { Topology } from '../lib/gateway'
import { NA, fmtUptime } from '../lib/format'
import {
  IconActivity,
  IconCircuit,
  IconFilter,
  IconGlobe,
  IconGrid,
  IconLayers,
  IconList,
  IconPlay,
  IconShield,
} from './Icons'

type NavItem = { to: string; label: string; icon: JSX.Element; end?: boolean }

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: <IconGrid size={17} />, end: true },
  { to: '/topology', label: 'Topology', icon: <IconGlobe size={17} /> },
  { to: '/traffic', label: 'Traffic', icon: <IconActivity size={17} /> },
  { to: '/services', label: 'Services', icon: <IconLayers size={17} /> },
  { to: '/circuit-breakers', label: 'Circuit Breakers', icon: <IconCircuit size={17} /> },
  { to: '/rate-limiting', label: 'Rate Limiting', icon: <IconFilter size={17} /> },
  { to: '/endpoints', label: 'API Endpoints', icon: <IconList size={17} /> },
  { to: '/playground', label: 'API Playground', icon: <IconPlay size={17} /> },
  { to: '/recent-traffic', label: 'Recent Traffic', icon: <IconList size={17} /> },
]

type Props = {
  topology: Topology | null
  uptimeSeconds: number | null
}

export function Sidebar({ topology, uptimeSeconds }: Props) {
  const status = topology?.status ?? null
  const operational = status === 'operational'

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">
          <IconShield size={19} />
        </span>
        <span className="brand-text">
          <strong>API GATEWAY</strong>
          <small>TRAFFIC CONTROL PLANE</small>
        </span>
      </div>

      <nav className="nav">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-item ${isActive ? 'nav-active' : ''}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="status-card">
          <span className="status-card-title">System Status</span>
          <span className={`status-line ${operational ? 'ok' : status ? 'warn' : 'bad'}`}>
            <span className="status-dot-sm" />
            {status === null ? 'Unreachable' : operational ? 'Operational' : 'Degraded'}
          </span>
          <span className="status-note">
            {status === null
              ? 'Cannot reach gateway'
              : operational
                ? 'All systems healthy'
                : 'Check services below'}
          </span>
          <div className="status-uptime">
            <span>Uptime</span>
            <strong>{uptimeSeconds !== null ? fmtUptime(uptimeSeconds) : NA}</strong>
          </div>
        </div>
        <div className="sidebar-version">
          <span>API Gateway</span>
          <span className="subtle">Go · Gin · Redis</span>
        </div>
      </div>
    </aside>
  )
}
