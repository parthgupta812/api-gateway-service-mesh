import { createContext, useContext, useState, type ReactNode } from 'react'
import { TIME_RANGES, useDashboardData, type TimeRange } from '../hooks/useDashboardData'

/**
 * Single shared polling loop for the whole app. Every page reads from this
 * context instead of running its own fetch loop, so navigating between
 * pages doesn't restart data loading and all pages stay in sync on the
 * same refresh cadence.
 */
type DashboardContextValue = ReturnType<typeof useDashboardData> & {
  range: TimeRange
  setRange: (r: TimeRange) => void
  refreshMs: number
  setRefreshMs: (ms: number) => void
}

const DashboardContext = createContext<DashboardContextValue | null>(null)

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [range, setRange] = useState<TimeRange>(TIME_RANGES[0])
  const [refreshMs, setRefreshMs] = useState(5000)
  const { data, reload } = useDashboardData(range, refreshMs)

  return (
    <DashboardContext.Provider value={{ data, reload, range, setRange, refreshMs, setRefreshMs }}>
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboard() {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboard must be used within a DashboardProvider')
  return ctx
}
