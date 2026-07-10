// hooks/useDashboard.ts
import useSWR from 'swr'
import { fetcher } from '@/lib/swr-fetcher'
import type {
  DashboardKpis,
  NeedsAttention,
  PlatformEvent,
  RevenuePeriod,
  RevenueChartPoint,
  CityRevenue,
  FunnelStage,
} from '@/types/dashboard'

// 30s auto-refresh matches the doc's "auto-refresh every 30 seconds" spec
const REFRESH_MS = 30_000
// 5s poll matches the doc's "Section 1.3 Live Activity (polled)" spec
const ACTIVITY_REFRESH_MS = 30_000

export function useDashboardKpis() {
  return useSWR<DashboardKpis>('/api/admin/dashboard/kpis', fetcher, {
    refreshInterval: REFRESH_MS,
    revalidateOnFocus: true,
  })
}

export function useNeedsAttention() {
  return useSWR<NeedsAttention>('/api/admin/dashboard/attention', fetcher, {
    refreshInterval: REFRESH_MS,
  })
}

export function useActivityFeed() {
  return useSWR<PlatformEvent[]>('/api/admin/dashboard/activity', fetcher, {
    refreshInterval: ACTIVITY_REFRESH_MS,
    revalidateOnFocus: true,
  })
}

export function useRevenueChart(period: RevenuePeriod) {
  return useSWR<{ chart: RevenueChartPoint[]; byCity: CityRevenue[] }>(
    `/api/admin/dashboard/revenue?period=${period}`,
    fetcher,
    { refreshInterval: REFRESH_MS }
  )
}

export function useBookingFunnel() {
  return useSWR<FunnelStage[]>('/api/admin/dashboard/funnel', fetcher, {
    refreshInterval: REFRESH_MS,
  })
}