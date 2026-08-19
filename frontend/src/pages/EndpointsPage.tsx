import { useNavigate } from 'react-router-dom'
import { useDashboard } from '../context/DashboardContext'
import { Page } from '../components/Page'
import { ENDPOINTS, GROUP_ORDER } from '../lib/endpoints'
import { NA, fmtMillisFromSeconds, fmtRate } from '../lib/format'

export default function EndpointsPage() {
  const { data } = useDashboard()
  const navigate = useNavigate()

  const rpsByRoute = new Map(data.routeRps.map((s) => [s.labels.route, s.value]))
  const latencyByRoute = new Map(data.routeAvgLatency.map((s) => [s.labels.route, s.value]))

  const test = (method: string, path: string) => {
    navigate(`/playground?method=${method}&path=${encodeURIComponent(path)}`)
  }

  return (
    <Page title="API Endpoints" subtitle="Available gateway routes" showRange={false}>
      {GROUP_ORDER.map((group) => {
        const rows = ENDPOINTS.filter((e) => e.group === group)
        return (
          <section className="card" key={group}>
            <div className="card-head">
              <div className="card-head-left">
                <h2>{group}</h2>
              </div>
              <span className="card-head-note">{rows.length} endpoint{rows.length === 1 ? '' : 's'}</span>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Route</th>
                    <th>Upstream</th>
                    <th className="ta-right">Requests / sec</th>
                    <th className="ta-right">Avg latency</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((ep) => {
                    const rps = ep.routeLabel ? rpsByRoute.get(ep.routeLabel) ?? null : null
                    const latency = ep.routeLabel ? latencyByRoute.get(ep.routeLabel) ?? null : null
                    return (
                      <tr key={`${ep.method}-${ep.path}`}>
                        <td>
                          <span className="method-chip">{ep.method}</span>
                        </td>
                        <td>
                          <span className="mono">{ep.path}</span>
                          <div className="endpoint-desc subtle">{ep.description}</div>
                        </td>
                        <td className="subtle">{ep.upstream ?? NA}</td>
                        <td className="ta-right mono">{fmtRate(rps)}</td>
                        <td className="ta-right mono">{fmtMillisFromSeconds(latency)}</td>
                        <td className="ta-right">
                          <button type="button" className="test-btn" onClick={() => test(ep.method, ep.path)}>
                            Test
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
    </Page>
  )
}
