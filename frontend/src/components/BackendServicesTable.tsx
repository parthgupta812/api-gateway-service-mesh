import type { DashboardData } from '../hooks/useDashboardData'
import { NA, fmtMillisFromSeconds, fmtRate } from '../lib/format'
import { Sparkline } from './charts/Sparkline'
import { IconBag, IconBox, IconUser } from './Icons'

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

const SPARK_COLOR: Record<string, string> = {
  user: '#2563eb',
  order: '#f59e0b',
  product: '#10b981',
}

export function BackendServicesTable({ data }: { data: DashboardData }) {
  const rpsByService = new Map(data.serviceRps.map((s) => [s.labels.service, s.value]))
  const latencyByRoute = new Map(data.routeAvgLatency.map((s) => [s.labels.route, s.value]))
  const services = data.topology?.services ?? []

  return (
    <section className="card">
      <div className="card-head">
        <div className="card-head-left">
          <h2>Backend Services</h2>
        </div>
      </div>

      {services.length === 0 ? (
        <p className="empty-note">Gateway state unavailable</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Instances</th>
                <th>Health</th>
                <th className="ta-right">Requests / sec</th>
                <th>Trend</th>
                <th className="ta-right">Avg latency</th>
              </tr>
            </thead>
            <tbody>
              {services.map((svc) => {
                const Icon = ICONS[svc.key] ?? IconBox
                const rps = rpsByService.get(svc.key) ?? null
                const route = ROUTE_BY_SERVICE[svc.key]
                const latency = route ? latencyByRoute.get(route) ?? null : null
                const allHealthy = svc.total > 0 && svc.healthy === svc.total
                return (
                  <tr key={svc.key}>
                    <td>
                      <span className="cell-service">
                        <Icon size={15} />
                        {svc.label}
                      </span>
                    </td>
                    <td>{svc.total}</td>
                    <td>
                      <span className={`health-badge ${allHealthy ? 'hb-ok' : svc.healthy > 0 ? 'hb-warn' : 'hb-bad'}`}>
                        <span className="hb-dot" />
                        {allHealthy ? 'Healthy' : svc.healthy > 0 ? `${svc.healthy}/${svc.total} healthy` : 'Unhealthy'}
                      </span>
                    </td>
                    <td className="ta-right mono">{fmtRate(rps)}</td>
                    <td>
                      <Sparkline
                        points={data.serviceSparklines[svc.key] ?? []}
                        color={SPARK_COLOR[svc.key] ?? '#64748b'}
                        width={70}
                        height={24}
                        fill={false}
                      />
                    </td>
                    <td className="ta-right">
                      <span className="latency-chip">{latency !== null ? fmtMillisFromSeconds(latency) : NA}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
