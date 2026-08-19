import type { Topology } from '../lib/gateway'
import { fmtClock } from '../lib/format'

const STATE_LABEL: Record<string, string> = {
  closed: 'CLOSED',
  half_open: 'HALF-OPEN',
  open: 'OPEN',
}

const STATE_CLASS: Record<string, string> = {
  closed: 'cb-closed',
  half_open: 'cb-half',
  open: 'cb-open',
}

export function CircuitBreakerTable({ topology }: { topology: Topology | null }) {
  const rows = (topology?.services ?? []).flatMap((svc) =>
    svc.instances.map((inst) => ({ service: svc.key, ...inst })),
  )

  return (
    <section className="card">
      <div className="card-head">
        <div className="card-head-left">
          <h2>Circuit Breakers</h2>
        </div>
        {topology && (
          <span className="card-head-note">
            threshold {topology.config.circuitBreakerFailureThreshold} · recovery{' '}
            {topology.config.circuitBreakerRecoveryTimeoutSeconds}s
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="empty-note">Gateway state unavailable</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Service instance</th>
                <th>State</th>
                <th className="ta-right">Failures</th>
                <th className="ta-right">Last state change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.addr}>
                  <td className="mono cell-instance">{r.name}</td>
                  <td>
                    <span className={`cb-badge ${STATE_CLASS[r.circuitState] ?? 'cb-closed'}`}>
                      {STATE_LABEL[r.circuitState] ?? r.circuitState.toUpperCase()}
                    </span>
                  </td>
                  <td className={`ta-right mono ${r.failures > 0 ? 'val-red' : ''}`}>{r.failures}</td>
                  <td className="ta-right mono subtle">{fmtClock(r.lastStateChange)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
