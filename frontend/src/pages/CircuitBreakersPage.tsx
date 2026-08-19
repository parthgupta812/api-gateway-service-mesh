import { useDashboard } from '../context/DashboardContext'
import { Page } from '../components/Page'
import { fmtClock } from '../lib/format'

const STATE_LABEL: Record<string, string> = { closed: 'CLOSED', half_open: 'HALF-OPEN', open: 'OPEN' }
const STATE_CLASS: Record<string, string> = { closed: 'cb-closed', half_open: 'cb-half', open: 'cb-open' }
const STATE_DESC: Record<string, string> = {
  closed: 'Requests flow normally. Failures are being counted.',
  half_open: 'Recovery timeout elapsed. A single probe request is being let through.',
  open: 'Requests are rejected immediately without contacting this instance.',
}

export default function CircuitBreakersPage() {
  const { data } = useDashboard()
  const cfg = data.topology?.config
  const rows = (data.topology?.services ?? []).flatMap((svc) =>
    svc.instances.map((inst) => ({ serviceLabel: svc.label, ...inst })),
  )

  const counts = { closed: 0, half_open: 0, open: 0 } as Record<string, number>
  for (const r of rows) counts[r.circuitState] = (counts[r.circuitState] ?? 0) + 1

  return (
    <Page title="Circuit Breakers" subtitle="Per-instance failure protection" showRange={false}>
      <div className="kpi-row kpi-row-4">
        <div className="card mini-stat">
          <span className="kpi-label">Failure threshold</span>
          <span className="kpi-value kpi-value-sm">{cfg ? `${cfg.circuitBreakerFailureThreshold} failures` : '—'}</span>
        </div>
        <div className="card mini-stat">
          <span className="kpi-label">Recovery timeout</span>
          <span className="kpi-value kpi-value-sm">{cfg ? `${cfg.circuitBreakerRecoveryTimeoutSeconds}s` : '—'}</span>
        </div>
        <div className="card mini-stat">
          <span className="kpi-label">Closed instances</span>
          <span className="kpi-value kpi-value-sm val-green">{counts.closed}</span>
        </div>
        <div className="card mini-stat">
          <span className="kpi-label">Open / half-open</span>
          <span className="kpi-value kpi-value-sm val-red">{counts.open + counts.half_open}</span>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <div className="card-head-left">
            <h2>Breaker state by instance</h2>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="empty-note">Gateway state unavailable</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Instance</th>
                  <th>State</th>
                  <th className="ta-right">Failures</th>
                  <th className="ta-right">Threshold</th>
                  <th className="ta-right">Recovery timeout</th>
                  <th className="ta-right">Last state change</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.addr}>
                    <td>{r.serviceLabel}</td>
                    <td className="mono cell-instance">{r.name}</td>
                    <td>
                      <span className={`cb-badge ${STATE_CLASS[r.circuitState] ?? 'cb-closed'}`}>
                        {STATE_LABEL[r.circuitState] ?? r.circuitState.toUpperCase()}
                      </span>
                    </td>
                    <td className={`ta-right mono ${r.failures > 0 ? 'val-red' : ''}`}>{r.failures}</td>
                    <td className="ta-right mono subtle">{cfg?.circuitBreakerFailureThreshold ?? '—'}</td>
                    <td className="ta-right mono subtle">{cfg ? `${cfg.circuitBreakerRecoveryTimeoutSeconds}s` : '—'}</td>
                    <td className="ta-right mono subtle">{fmtClock(r.lastStateChange)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <div className="card-head-left">
            <h2>State reference</h2>
          </div>
        </div>
        <div className="state-legend">
          {(['closed', 'half_open', 'open'] as const).map((s) => (
            <div key={s} className="state-legend-item">
              <span className={`cb-badge ${STATE_CLASS[s]}`}>{STATE_LABEL[s]}</span>
              <p>{STATE_DESC[s]}</p>
            </div>
          ))}
        </div>
      </section>
    </Page>
  )
}
