import type { Sample } from '../lib/prometheus'
import type { Topology as TopologyState } from '../lib/gateway'
import { fmtRate } from '../lib/format'
import { IconBag, IconBox, IconDatabase, IconFilter, IconGauge, IconHeart, IconCircuit, IconShield, IconUser, IconUsers } from './Icons'

type Props = {
  topology: TopologyState | null
  serviceRps: Sample[]
  showTraffic: boolean
  onToggleTraffic: (next: boolean) => void
}

const SERVICE_ICONS: Record<string, (p: { size?: number }) => JSX.Element> = {
  user: IconUser,
  order: IconBag,
  product: IconBox,
}

const SERVICE_ACCENT: Record<string, string> = {
  user: 'accent-blue',
  order: 'accent-amber',
  product: 'accent-green',
}

/**
 * The dashboard centerpiece: Client -> Gateway -> backend services, with
 * the order service fanning out to its individual instances.
 *
 * Health comes from the gateway's live registry state and per-instance
 * circuit breaker state; request rates come from Prometheus.
 */
export function Topology({ topology, serviceRps, showTraffic, onToggleTraffic }: Props) {
  const rpsByService = new Map(serviceRps.map((s) => [s.labels.service, s.value]))

  const services = topology?.services ?? []
  const orderService = services.find((s) => s.key === 'order')
  const redisConnected = topology?.redis === 'ok'
  const gatewayHealthy = topology !== null

  return (
    <section className="card topology-card">
      <div className="card-head">
        <div className="card-head-left">
          <h2>Service Topology</h2>
          <span className={`pill ${topology ? 'pill-live' : 'pill-muted'}`}>
            <span className="pulse-dot" />
            {topology ? 'Live' : 'Offline'}
          </span>
        </div>
        <label className="toggle">
          <span>Show traffic</span>
          <input type="checkbox" checked={showTraffic} onChange={(e) => onToggleTraffic(e.target.checked)} />
          <span className="toggle-track" aria-hidden>
            <span className="toggle-thumb" />
          </span>
        </label>
      </div>

      <div className="topo">
        {/* Client */}
        <div className="topo-col topo-col-client">
          <div className="node node-client">
            <IconUsers size={22} />
            <span className="node-title">Clients</span>
            <span className="node-sub">HTTP</span>
          </div>
        </div>

        <div className="topo-link">
          <span className="link-label">HTTP</span>
          <Connector active={showTraffic && gatewayHealthy} />
        </div>

        {/* Gateway */}
        <div className="topo-col topo-col-gateway">
          <div className={`node node-gateway ${gatewayHealthy ? '' : 'node-down'}`}>
            <div className="node-gateway-head">
              <span className="node-gateway-icon">
                <IconShield size={16} />
              </span>
              <span className="node-title">API GATEWAY</span>
              <StatusDot healthy={gatewayHealthy} />
            </div>
            <ul className="capabilities">
              <li>
                <IconFilter size={13} /> Rate Limiting
              </li>
              <li>
                <IconGauge size={13} /> Load Balancing
              </li>
              <li>
                <IconHeart size={13} /> Health Checks
              </li>
              <li>
                <IconCircuit size={13} /> Circuit Breakers
              </li>
            </ul>
          </div>
        </div>

        <div className="topo-fan">
          <Fan active={showTraffic && gatewayHealthy} rows={services.length + 1} />
        </div>

        {/* Services */}
        <div className="topo-col topo-col-services">
          {services.map((svc) => {
            const Icon = SERVICE_ICONS[svc.key] ?? IconBox
            const allHealthy = svc.total > 0 && svc.healthy === svc.total
            const someHealthy = svc.healthy > 0
            const rps = rpsByService.get(svc.key)
            return (
              <div key={svc.key} className={`node node-service ${SERVICE_ACCENT[svc.key] ?? ''} ${someHealthy ? '' : 'node-down'}`}>
                <span className="node-service-icon">
                  <Icon size={16} />
                </span>
                <span className="node-body">
                  <span className="node-title">{svc.label}</span>
                  <span className="node-sub">
                    {svc.total} {svc.total === 1 ? 'instance' : 'instances'}
                    {showTraffic && rps !== undefined ? ` · ${fmtRate(rps)}/s` : ''}
                  </span>
                </span>
                <StatusDot healthy={allHealthy} partial={someHealthy && !allHealthy} />
              </div>
            )
          })}

          <div className={`node node-service accent-violet ${redisConnected ? '' : 'node-down'}`}>
            <span className="node-service-icon">
              <IconDatabase size={16} />
            </span>
            <span className="node-body">
              <span className="node-title">Redis</span>
              <span className="node-sub">{redisConnected ? 'Connected' : 'Unavailable'}</span>
            </span>
            <StatusDot healthy={redisConnected} />
          </div>
        </div>

        {/* Order service instances */}
        <div className="topo-col topo-col-instances">
          {orderService ? (
            <div className="instance-group">
              <div className="instance-group-rail" aria-hidden />
              {orderService.instances.map((inst) => (
                <div key={inst.addr} className={`node node-instance ${inst.healthy ? '' : 'node-down'}`}>
                  <span className="node-body">
                    <span className="node-title">{inst.name}</span>
                    <span className="node-sub">
                      {inst.healthy ? 'Healthy' : 'Unhealthy'}
                      {inst.circuitState !== 'closed' ? ` · ${inst.circuitState.replace('_', '-')}` : ''}
                    </span>
                  </span>
                  <StatusDot healthy={inst.healthy && inst.circuitState === 'closed'} partial={inst.healthy && inst.circuitState !== 'closed'} />
                </div>
              ))}
            </div>
          ) : (
            <div className="topo-placeholder">N/A</div>
          )}
        </div>
      </div>
    </section>
  )
}

function StatusDot({ healthy, partial = false }: { healthy: boolean; partial?: boolean }) {
  const cls = healthy ? 'dot-green' : partial ? 'dot-amber' : 'dot-red'
  const label = healthy ? 'healthy' : partial ? 'degraded' : 'unhealthy'
  return <span className={`status-dot ${cls}`} role="img" aria-label={label} title={label} />
}

function Connector({ active }: { active: boolean }) {
  return (
    <svg className="connector" viewBox="0 0 60 12" preserveAspectRatio="none" aria-hidden>
      <path d="M0 6 H60" className={`conn-path ${active ? 'conn-active' : ''}`} />
    </svg>
  )
}

function Fan({ active, rows }: { active: boolean; rows: number }) {
  const H = 100
  const step = rows > 1 ? H / (rows - 1) : H
  return (
    <svg className="fan" viewBox={`0 0 44 ${H}`} preserveAspectRatio="none" aria-hidden>
      {Array.from({ length: rows }, (_, i) => {
        const targetY = i * step
        return (
          <path
            key={i}
            d={`M0 ${H / 2} C22 ${H / 2}, 22 ${targetY}, 44 ${targetY}`}
            className={`conn-path ${active ? 'conn-active' : ''}`}
          />
        )
      })}
    </svg>
  )
}
