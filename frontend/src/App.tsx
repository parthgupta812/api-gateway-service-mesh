import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { DashboardProvider } from './context/DashboardContext'
import { Layout } from './components/Layout'
import DashboardHome from './pages/DashboardHome'
import TopologyPage from './pages/TopologyPage'
import TrafficPage from './pages/TrafficPage'
import ServicesPage from './pages/ServicesPage'
import CircuitBreakersPage from './pages/CircuitBreakersPage'
import RateLimitingPage from './pages/RateLimitingPage'
import EndpointsPage from './pages/EndpointsPage'
import PlaygroundPage from './pages/PlaygroundPage'
import RecentTrafficPage from './pages/RecentTrafficPage'

export default function App() {
  return (
    <BrowserRouter>
      <DashboardProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<DashboardHome />} />
            <Route path="topology" element={<TopologyPage />} />
            <Route path="traffic" element={<TrafficPage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="circuit-breakers" element={<CircuitBreakersPage />} />
            <Route path="rate-limiting" element={<RateLimitingPage />} />
            <Route path="endpoints" element={<EndpointsPage />} />
            <Route path="playground" element={<PlaygroundPage />} />
            <Route path="recent-traffic" element={<RecentTrafficPage />} />
            <Route path="*" element={<DashboardHome />} />
          </Route>
        </Routes>
      </DashboardProvider>
    </BrowserRouter>
  )
}
