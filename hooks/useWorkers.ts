// hooks/useWorkers.ts
import useSWR from 'swr'
import { useState } from 'react'
import { fetcher } from '@/lib/swr-fetcher'
import type {
  AvailabilityAwareList,
  CategoryOption,
  WorkerAvailabilityData,
  WorkerBadgeKey,
  WorkerCatalog,
  WorkerDetail,
  WorkerDocumentRow,
  WorkerEarnings,
  WorkerFilters,
  WorkerJobRow,
  WorkerKpis,
  WorkerListResponse,
  WorkerPerformance,
  WorkerReviewRow,
} from '@/types/worker'

export const DEFAULT_WORKER_FILTERS: WorkerFilters = {
  search: '',
  city: 'all',
  categoryId: 'all',
  verification: 'all',
  status: 'all',
  presence: 'all',
  ratingBucket: 'all',
  dateFrom: null,
  dateTo: null,
  sortBy: 'created_at',
  sortDir: 'desc',
  page: 1,
  pageSize: 20,
}

function filterParams(filters: WorkerFilters): URLSearchParams {
  const qs = new URLSearchParams()
  if (filters.search) qs.set('search', filters.search)
  if (filters.city !== 'all') qs.set('city', filters.city)
  if (filters.categoryId !== 'all') qs.set('categoryId', filters.categoryId)
  if (filters.verification !== 'all') qs.set('verification', filters.verification)
  if (filters.status !== 'all') qs.set('status', filters.status)
  if (filters.presence !== 'all') qs.set('presence', filters.presence)
  if (filters.ratingBucket !== 'all') qs.set('ratingBucket', filters.ratingBucket)
  if (filters.dateFrom) qs.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) qs.set('dateTo', filters.dateTo)
  return qs
}

function buildQuery(filters: WorkerFilters) {
  const qs = filterParams(filters)
  qs.set('sortBy', filters.sortBy)
  qs.set('sortDir', filters.sortDir)
  qs.set('page', String(filters.page))
  qs.set('pageSize', String(filters.pageSize))
  return qs.toString()
}

/** Query string for the CSV export: filters only, no paging/sorting. */
export function buildWorkerExportQuery(filters: WorkerFilters): string {
  return filterParams(filters).toString()
}

export function useWorkerKpis() {
  const { data, error, isLoading, mutate } = useSWR<WorkerKpis>(
    '/api/admin/workers/kpis',
    fetcher,
    { refreshInterval: 30_000 } // "Online now" is live data
  )
  return { kpis: data, isLoading, error, mutate }
}

export function useWorkerFilterOptions() {
  const { data } = useSWR<{ categories: CategoryOption[] }>(
    '/api/admin/workers/filter-options',
    fetcher
  )
  return { categories: data?.categories ?? [] }
}

export function useWorkersList(filters: WorkerFilters) {
  const { data, error, isLoading, mutate } = useSWR<WorkerListResponse>(
    `/api/admin/workers?${buildQuery(filters)}`,
    fetcher,
    { keepPreviousData: true }
  )
  return { workers: data, isLoading, error, mutate }
}

export function useWorkerFilters(initial: Partial<WorkerFilters> = {}) {
  const [filters, setFilters] = useState<WorkerFilters>({ ...DEFAULT_WORKER_FILTERS, ...initial })

  function update(patch: Partial<WorkerFilters>) {
    // any real filter change resets pagination back to page 1
    const resetsPage = Object.keys(patch).some((k) => k !== 'page')
    setFilters((prev) => ({ ...prev, ...patch, page: resetsPage ? 1 : (patch.page ?? prev.page) }))
  }

  function reset() {
    setFilters(DEFAULT_WORKER_FILTERS)
  }

  return { filters, update, reset }
}

export function useWorkerDetail(workerId: string) {
  const { data, error, isLoading, mutate } = useSWR<WorkerDetail>(
    workerId ? `/api/admin/workers/${workerId}` : null,
    fetcher,
    { refreshInterval: 30_000 } // keeps the presence indicator fresh
  )
  return { worker: data, isLoading, error, mutate }
}

export function useWorkerPerformance(workerId: string) {
  const { data, error, isLoading, mutate } = useSWR<WorkerPerformance>(
    workerId ? `/api/admin/workers/${workerId}/performance` : null,
    fetcher
  )
  return { stats: data, isLoading, error, mutate }
}

export function useWorkerEarnings(workerId: string) {
  const { data, error, isLoading, mutate } = useSWR<WorkerEarnings>(
    workerId ? `/api/admin/workers/${workerId}/earnings` : null,
    fetcher
  )
  return { earnings: data, isLoading, error, mutate }
}

export function useWorkerJobs(workerId: string) {
  const { data, error, isLoading, mutate } = useSWR<AvailabilityAwareList<WorkerJobRow>>(
    workerId ? `/api/admin/workers/${workerId}/jobs` : null,
    fetcher
  )
  return { jobs: data?.data ?? [], available: data?.available ?? true, isLoading, error, mutate }
}

export function useWorkerReviews(workerId: string) {
  const { data, error, isLoading, mutate } = useSWR<AvailabilityAwareList<WorkerReviewRow>>(
    workerId ? `/api/admin/workers/${workerId}/reviews` : null,
    fetcher
  )
  return { reviews: data?.data ?? [], available: data?.available ?? true, isLoading, error, mutate }
}

export function useWorkerAvailability(workerId: string) {
  const { data, error, isLoading, mutate } = useSWR<WorkerAvailabilityData>(
    workerId ? `/api/admin/workers/${workerId}/availability` : null,
    fetcher
  )
  return { availability: data, isLoading, error, mutate }
}

export function useWorkerCatalog(workerId: string) {
  const { data, error, isLoading, mutate } = useSWR<WorkerCatalog>(
    workerId ? `/api/admin/workers/${workerId}/catalog` : null,
    fetcher
  )
  return { catalog: data, isLoading, error, mutate }
}

/** `enabled = false` skips the request entirely (admin lacks workers:verify). */
export function useWorkerDocuments(workerId: string, enabled: boolean) {
  const { data, error, isLoading, mutate } = useSWR<WorkerDocumentRow[]>(
    workerId && enabled ? `/api/admin/workers/${workerId}/documents` : null,
    fetcher
  )
  return { documents: data ?? [], isLoading, error, mutate }
}

// --- Mutations ---

async function send(method: 'POST' | 'PATCH', url: string, body?: object) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Action failed')
  return json
}

export const workerActions = {
  warn: (workerId: string, reason: string) =>
    send('POST', `/api/admin/workers/${workerId}/actions/warn`, { reason }),
  suspend: (
    workerId: string,
    reason: string,
    duration: '7d' | '30d' | 'custom',
    until?: string
  ) => send('POST', `/api/admin/workers/${workerId}/actions/suspend`, { reason, duration, until }),
  unsuspend: (workerId: string) =>
    send('POST', `/api/admin/workers/${workerId}/actions/unsuspend`),
  ban: (workerId: string, reason: string) =>
    send('POST', `/api/admin/workers/${workerId}/actions/ban`, { reason }),
  editContact: (workerId: string, phone?: string, email?: string) =>
    send('PATCH', `/api/admin/workers/${workerId}/actions/edit-contact`, { phone, email }),
  setFeatured: (workerId: string, featured: boolean) =>
    send('POST', `/api/admin/workers/${workerId}/actions/feature`, { featured }),
  setBadge: (workerId: string, badge: WorkerBadgeKey, action: 'add' | 'remove') =>
    send('POST', `/api/admin/workers/${workerId}/actions/badge`, { badge, action }),
  forceOffline: (workerId: string, reason: string) =>
    send('POST', `/api/admin/workers/${workerId}/actions/force-offline`, { reason }),
  requestReverification: (workerId: string, reason: string) =>
    send('POST', `/api/admin/workers/${workerId}/actions/request-reverification`, { reason }),
}