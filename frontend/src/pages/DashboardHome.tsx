import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useDashboard } from '../context/DashboardContext'
import { Page } from '../components/Page'
import { KpiCards } from '../components/KpiCards'
import { Topology } from '../components/Topology'
import { TrafficDistribution } from '../components/TrafficDistribution'
import { RecentTraffic } from '../components/RecentTraffic'
import { QuickLinks } from '../components/QuickLinks'
import { IconActivity, IconArrowRight, IconGlobe, IconLayers, IconPlay } from '../components/Icons'

const JUMP_LINKS = [
  { to: '/topology', label: 'View Topology', icon: <IconGlobe size={15} /> },
  { to: '/traffic', label: 'View Traffic', icon: <IconActivity size={15} /> },
  { to: '/services', label: 'View Services', icon: <IconLayers size={15} /> },
  { to: '/playground', label: 'Open API Playground', icon: <IconPlay size={15} /> },
]

/**
 * High-level system overview. Deliberately compact: full detail tables
 * live on their own dedicated pages, reachable via the jump links below
 * and the sidebar.
 */
export default function DashboardHome() {
  const { data, range } = useDashboard()
  const [showTraffic, setShowTraffic] = useState(true)

  return (
    <Page title="Dashboard" subtitle="API Gateway overview">
      <KpiCards data={data} />

      <div className="jump-row">
        {JUMP_LINKS.map((l) => (
          <Link key={l.to} to={l.to} className="jump-link">
            {l.icon}
            <span>{l.label}</span>
            <IconArrowRight size={14} className="jump-arrow" />
          </Link>
        ))}
      </div>

      <div className="grid grid-main">
        <Topology
          topology={data.topology}
          serviceRps={data.serviceRps}
          showTraffic={showTraffic}
          onToggleTraffic={setShowTraffic}
        />
        <TrafficDistribution data={data} rangeLabel={range.label} />
      </div>

      <div className="grid grid-two">
        <RecentTraffic requests={data.recentRequests} />
        <QuickLinks />
      </div>
    </Page>
  )
}
