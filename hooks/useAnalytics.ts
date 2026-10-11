// hooks/useAnalytics.ts
import useSWR from 'swr'
import { fetcher } from '@/lib/swr-fetcher'
import type {
  AnalyticsCategories,
  AnalyticsCities,
  AnalyticsFunnels,
  AnalyticsGrowth,
  AnalyticsKpis,
  AnalyticsRange,
} from '@/types/analytics'

// Analytics is heavier than the ops pages and does not need live data: refresh once a minute.
const REFRESH_MS = 60_000

export function useAnalyticsKpis() {
  const { data, error, isLoading, mutate } = useSWR<AnalyticsKpis>(
    '/api/admin/analytics/kpis',
    fetcher,
    { refreshInterval: REFRESH_MS, keepPreviousData: true }
  )
  return { kpis: data, isLoading, error, mutate }
}

export function useAnalyticsGrowth(days: AnalyticsRange) {
  const { data, error, isLoading, mutate } = useSWR<AnalyticsGrowth>(
    `/api/admin/analytics/growth?days=${days}`,
    fetcher,
    { refreshInterval: REFRESH_MS, keepPreviousData: true }
  )
  return { growth: data, isLoading, error, mutate }
}

export function useAnalyticsFunnels(days: AnalyticsRange) {
  const { data, error, isLoading, mutate } = useSWR<AnalyticsFunnels>(
    `/api/admin/analytics/funnels?days=${days}`,
    fetcher,
    { refreshInterval: REFRESH_MS, keepPreviousData: true }
  )
  return { funnels: data, isLoading, error, mutate }
}

export function useAnalyticsCities(days: AnalyticsRange) {
  const { data, error, isLoading, mutate } = useSWR<AnalyticsCities>(
    `/api/admin/analytics/cities?days=${days}`,
    fetcher,
    { refreshInterval: REFRESH_MS, keepPreviousData: true }
  )
  return { cities: data, isLoading, error, mutate }
}

export function useAnalyticsCategories(days: AnalyticsRange) {
  const { data, error, isLoading, mutate } = useSWR<AnalyticsCategories>(
    `/api/admin/analytics/categories?days=${days}`,
    fetcher,
    { refreshInterval: REFRESH_MS, keepPreviousData: true }
  )
  return { categories: data, isLoading, error, mutate }
}