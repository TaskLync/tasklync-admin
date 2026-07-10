// hooks/useWaitlist.ts
import useSWR from 'swr'
import { fetcher } from '@/lib/swr-fetcher'
import type {
  WaitlistKpis,
  WaitlistGrowthPeriod,
  WaitlistGrowthResponse,
  UtmBreakdownResponse,
  DeviceBreakdownResponse,
  WaitlistListResponse,
  WaitlistFilters,
} from '@/types/waitlist'

export function useWaitlistKpis() {
  return useSWR<WaitlistKpis>('/api/admin/waitlist/kpis', fetcher, {
    refreshInterval: 30_000,
  })
}

export function useWaitlistGrowth(period: WaitlistGrowthPeriod) {
  return useSWR<WaitlistGrowthResponse>(`/api/admin/waitlist/growth?period=${period}`, fetcher)
}

export function useUtmBreakdown() {
  return useSWR<UtmBreakdownResponse>('/api/admin/waitlist/utm-breakdown', fetcher, {
    refreshInterval: 60_000,
  })
}

export function useDeviceBreakdown() {
  return useSWR<DeviceBreakdownResponse>('/api/admin/waitlist/device-breakdown', fetcher)
}

function buildQuery(filters: WaitlistFilters): string {
  const params = new URLSearchParams()
  if (filters.search) params.set('search', filters.search)
  if (filters.status && filters.status !== 'all') params.set('status', filters.status)
  if (filters.utm_source && filters.utm_source !== 'all')
    params.set('utm_source', filters.utm_source)
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  if (filters.sortBy) params.set('sortBy', filters.sortBy)
  if (filters.sortDir) params.set('sortDir', filters.sortDir)
  params.set('page', String(filters.page ?? 1))
  params.set('pageSize', String(filters.pageSize ?? 25))
  return params.toString()
}

export function useWaitlistList(filters: WaitlistFilters) {
  const query = buildQuery(filters)
  return useSWR<WaitlistListResponse>(`/api/admin/waitlist?${query}`, fetcher, {
    keepPreviousData: true,
  })
}