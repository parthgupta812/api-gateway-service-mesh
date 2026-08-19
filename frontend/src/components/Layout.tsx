import { Outlet } from 'react-router-dom'
import { useDashboard } from '../context/DashboardContext'
import { Sidebar } from './Sidebar'

/** App shell: persistent sidebar + routed page content. Mounted once, so
 * navigating between pages never remounts the sidebar or restarts data
 * polling (that lives in DashboardProvider, above this in the tree). */
export function Layout() {
  const { data } = useDashboard()

  return (
    <div className="shell">
      <Sidebar topology={data.topology} uptimeSeconds={data.uptimeSeconds} />
      <main className="main">
        <Outlet />
        <footer className="foot subtle">
          Live data from the gateway&rsquo;s Prometheus metrics and read-only introspection endpoints. Metrics shown
          as N/A have no series yet.
        </footer>
      </main>
    </div>
  )
}
