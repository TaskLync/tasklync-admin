// hooks/useMap.ts
import useSWR from 'swr'
import { useState } from 'react'
import { fetcher } from '@/lib/swr-fetcher'
import {
  DEMAND_REFRESH_MS,
  JOBS_REFRESH_MS,
  WORKERS_REFRESH_MS,
} from '@/lib/map-constants'
import type {
  MapDemandResponse,
  MapFilters,
  MapJobsResponse,
  MapWorkersResponse,
} from '@/types/map'

export const DEFAULT_MAP_FILTERS: MapFilters = {
  city: 'all',
  categoryId: 'all',
  includeOffline: false,
}

function baseParams(filters: MapFilters): URLSearchParams {
  const qs = new URLSearchParams()
  if (filters.city !== 'all') qs.set('city', filters.city)
  if (filters.categoryId !== 'all') qs.set('categoryId', filters.categoryId)
  return qs
}

/** `live = false` stops polling (the admin paused the live feed) but keeps the last data on screen. */
export function useMapWorkers(filters: MapFilters, live: boolean) {
  const qs = baseParams(filters)
  if (filters.includeOffline) qs.set('includeOffline', 'true')

  const { data, error, isLoading, mutate } = useSWR<MapWorkersResponse>(
    `/api/admin/map/workers?${qs.toString()}`,
    fetcher,
    {
      refreshInterval: live ? WORKERS_REFRESH_MS : 0,
      keepPreviousData: true,
      revalidateOnFocus: true,
      dedupingInterval: 2_000,
    }
  )
  return { workers: data, isLoading, error, mutate }
}

export function useMapJobs(filters: MapFilters, live: boolean) {
  const { data, error, isLoading, mutate } = useSWR<MapJobsResponse>(
    `/api/admin/map/bookings?${baseParams(filters).toString()}`,
    fetcher,
    {
      refreshInterval: live ? JOBS_REFRESH_MS : 0,
      keepPreviousData: true,
      revalidateOnFocus: true,
    }
  )
  return { jobs: data, isLoading, error, mutate }
}

/** `enabled = false` skips the request entirely (heatmap layer is off). Demand ignores the city filter. */
export function useMapDemand(
  filters: Pick<MapFilters, 'categoryId'>,
  hours: number,
  enabled: boolean,
  live: boolean
) {
  const qs = new URLSearchParams({ hours: String(hours) })
  if (filters.categoryId !== 'all') qs.set('categoryId', filters.categoryId)

  const { data, error, isLoading, mutate } = useSWR<MapDemandResponse>(
    enabled ? `/api/admin/map/demand?${qs.toString()}` : null,
    fetcher,
    {
      refreshInterval: live ? DEMAND_REFRESH_MS : 0,
      keepPreviousData: true,
    }
  )
  return { demand: data, isLoading, error, mutate }
}

export function useMapFilters(initial: Partial<MapFilters> = {}) {
  const [filters, setFilters] = useState<MapFilters>({ ...DEFAULT_MAP_FILTERS, ...initial })

  function update(patch: Partial<MapFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }))
  }

  function reset() {
    setFilters(DEFAULT_MAP_FILTERS)
  }

  return { filters, update, reset }
}