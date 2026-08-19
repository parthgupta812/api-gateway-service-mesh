import { useState } from 'react'
import { useDashboard } from '../context/DashboardContext'
import { Page } from '../components/Page'
import { Topology } from '../components/Topology'
import { CircuitBreakerTable } from '../components/CircuitBreakerTable'

export default function TopologyPage() {
  const { data } = useDashboard()
  const [showTraffic, setShowTraffic] = useState(true)

  return (
    <Page title="Topology" subtitle="Service topology and routing" showRange={false}>
      <Topology
        topology={data.topology}
        serviceRps={data.serviceRps}
        showTraffic={showTraffic}
        onToggleTraffic={setShowTraffic}
      />
      <CircuitBreakerTable topology={data.topology} />
    </Page>
  )
}
