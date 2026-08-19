import { useDashboard } from '../context/DashboardContext'
import { Page } from '../components/Page'
import { NA, fmtMillisFromSeconds, fmtRate } from '../lib/format'
import { IconBag, IconBox, IconUser } from '../components/Icons'

const ICONS: Record<string, (p: { size?: number }) => JSX.Element> = {
  user: IconUser,
  order: IconBag,
  product: IconBox,
}

const ROUTE_BY_SERVICE: Record<string, string> = {
  user: '/api/users',
  order: '/api/orders',
  product: '/api/products',
}

const STATE_LABEL: Record<string, string> = { closed: 'CLOSED', half_open: 'HALF-OPEN', open: 'OPEN' }
const STATE_CLASS: Record<string, string> = { closed: 'cb-closed', half_open: 'cb-half', open: 'cb-open' }

/**
 * Per-instance backend service health. Every instance gets its own row —
 * for the order service that means order-service-1/2/3 individually, not
 * a rolled-up count, since instance-level detail is the point of this page.
 */
export default function ServicesPage() {
  const { data } = useDashboard()
  const services = data.topology?.services ?? []
  const latencyByRoute = new Map(data.routeAvgLatency.map((s) => [s.labels.route, s.value]))
  const rpsByUpstream = new Map(data.orderInstanceRps.map((s) => [s.labels.upstream, s.value]))
  const serviceRpsByKey = new Map(data.serviceRps.map((s) => [s.labels.service, s.value]))

  return (
    <Page title="Services" subtitle="Backend service health and performance">
      {services.length === 0 ? (
        <section className="card">
          <p className="empty-note">Gateway state unavailable</p>
        </section>
      ) : (
        services.map((svc) => {
          const Icon = ICONS[svc.key] ?? IconBox
          const route = ROUTE_BY_SERVICE[svc.key]
          const serviceLatency = route ? latencyByRoute.get(route) ?? null : null
          const serviceRps = serviceRpsByKey.get(svc.key) ?? null
          const allHealthy = svc.total > 0 && svc.healthy === svc.total

          return (
            <section className="card" key={svc.key}>
              <div className="card-head">
                <div className="card-head-left">
                  <span className="cell-service-icon">
                    <Icon size={16} />
                  </span>
                  <h2>{svc.label}</h2>
                  <span className={`health-badge ${allHealthy ? 'hb-ok' : svc.healthy > 0 ? 'hb-warn' : 'hb-bad'}`}>
                    <span className="hb-dot" />
                    {allHealthy ? 'Healthy' : svc.healthy > 0 ? `${svc.healthy}/${svc.total} healthy` : 'Unhealthy'}
                  </span>
                </div>
                <span className="card-head-note">
                  {fmtRate(serviceRps)} req/s aggregate · {fmtMillisFromSeconds(serviceLatency)} avg latency
                </span>
              </div>

              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Instance</th>
                      <th>Health</th>
                      <th className="ta-right">Requests / sec</th>
                      <th className="ta-right">Avg latency</th>
                      <th>Circuit state</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {svc.instances.map((inst) => {
                      const instRps = rpsByUpstream.get(inst.addr) ?? null
                      const currentStatus =
                        !inst.healthy ? 'Down (health check failed)' : inst.circuitState !== 'closed' ? 'Degraded (breaker open)' : 'Serving traffic'
                      return (
                        <tr key={inst.addr}>
                          <td className="mono cell-instance">{inst.name}</td>
                          <td>
                            <span className={`health-badge ${inst.healthy ? 'hb-ok' : 'hb-bad'}`}>
                              <span className="hb-dot" />
                              {inst.healthy ? 'Healthy' : 'Unhealthy'}
                            </span>
                          </td>
                          <td className="ta-right mono">{svc.key === 'order' ? fmtRate(instRps) : fmtRate(serviceRps)}</td>
                          <td className="ta-right mono">{fmtMillisFromSeconds(serviceLatency)}</td>
                          <td>
                            <span className={`cb-badge ${STATE_CLASS[inst.circuitState] ?? 'cb-closed'}`}>
                              {STATE_LABEL[inst.circuitState] ?? inst.circuitState.toUpperCase()}
                            </span>
                          </td>
                          <td className="subtle">{currentStatus}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )
        })
      )}

      <section className="card">
        <div className="card-head">
          <div className="card-head-left">
            <h2>Redis</h2>
          </div>
        </div>
        <p className="empty-note">
          Status: <strong className={data.topology?.redis === 'ok' ? 'val-green' : 'val-red'}>
            {data.topology?.redis ?? NA}
          </strong>
          {' — '}used by the rate limiter for atomic per-client request counting.
        </p>
      </section>
    </Page>
  )
}
