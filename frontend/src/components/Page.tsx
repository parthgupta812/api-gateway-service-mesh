import type { ReactNode } from 'react'
import { useDashboard } from '../context/DashboardContext'
import { PageHeader } from './PageHeader'

type Props = {
  title: string
  subtitle: string
  showRange?: boolean
  actions?: ReactNode
  children: ReactNode
}

/**
 * Standard page shell: header wired to the shared dashboard context, an
 * error banner if a data source failed, and the page's own content below.
 * Used by every routed page so each one only needs to describe its title
 * and panels.
 */
export function Page({ title, subtitle, showRange = true, actions, children }: Props) {
  const { data, reload, range, setRange, refreshMs, setRefreshMs } = useDashboard()

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        topology={data.topology}
        uptimeSeconds={data.uptimeSeconds}
        prometheusUp={data.prometheusUp}
        lastUpdated={data.lastUpdated}
        loading={data.loading}
        range={range}
        onRangeChange={setRange}
        refreshMs={refreshMs}
        onRefreshMsChange={setRefreshMs}
        onRefresh={reload}
        showRange={showRange}
        actions={actions}
      />

      {data.error && (
        <div className="banner banner-error">
          <strong>Data source error:</strong> {data.error}
          <span className="banner-note">Values shown as N/A could not be read from Prometheus or the gateway.</span>
        </div>
      )}

      {children}
    </>
  )
}
