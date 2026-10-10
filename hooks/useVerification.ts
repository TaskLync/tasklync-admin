// hooks/useVerification.ts
import useSWR from 'swr'
import { useState } from 'react'
import { fetcher } from '@/lib/swr-fetcher'
import type { RejectionCode } from '@/lib/verification-constants'
import type {
  CnicDuplicate,
  VerificationCounts,
  VerificationDetail,
  VerificationQueueFilters,
  VerificationQueueResponse,
} from '@/types/verification'

export const DEFAULT_VERIFICATION_FILTERS: VerificationQueueFilters = {
  tab: 'pending',
  search: '',
  city: 'all',
  categoryId: 'all',
  page: 1,
  pageSize: 20,
}

function buildQuery(filters: VerificationQueueFilters) {
  const qs = new URLSearchParams()
  qs.set('tab', filters.tab)
  if (filters.search) qs.set('search', filters.search)
  if (filters.city !== 'all') qs.set('city', filters.city)
  if (filters.categoryId !== 'all') qs.set('categoryId', filters.categoryId)
  qs.set('page', String(filters.page))
  qs.set('pageSize', String(filters.pageSize))
  return qs.toString()
}

export function useVerificationCounts() {
  const { data, error, isLoading, mutate } = useSWR<VerificationCounts>(
    '/api/admin/workers/verification/counts',
    fetcher,
    { refreshInterval: 30_000 }
  )
  return { counts: data, isLoading, error, mutate }
}

export function useVerificationQueue(filters: VerificationQueueFilters) {
  const { data, error, isLoading, mutate } = useSWR<VerificationQueueResponse>(
    `/api/admin/workers/verification?${buildQuery(filters)}`,
    fetcher,
    { keepPreviousData: true, refreshInterval: 60_000 }
  )
  return { queue: data, isLoading, error, mutate }
}

export function useVerificationFilters() {
  const [filters, setFilters] = useState<VerificationQueueFilters>(DEFAULT_VERIFICATION_FILTERS)

  function update(patch: Partial<VerificationQueueFilters>) {
    // any real change (tab, search, city...) resets pagination to page 1
    const resetsPage = Object.keys(patch).some((k) => k !== 'page')
    setFilters((prev) => ({ ...prev, ...patch, page: resetsPage ? 1 : (patch.page ?? prev.page) }))
  }

  function reset() {
    setFilters((prev) => ({ ...DEFAULT_VERIFICATION_FILTERS, tab: prev.tab }))
  }

  return { filters, update, reset }
}

export function useVerificationDetail(workerId: string) {
  const { data, error, isLoading, mutate } = useSWR<VerificationDetail>(
    workerId ? `/api/admin/workers/${workerId}/verification` : null,
    fetcher
  )
  return { detail: data, isLoading, error, mutate }
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

export const verificationActions = {
  markViewed: (workerId: string) =>
    send('POST', `/api/admin/workers/${workerId}/verification/view`),

  saveCnic: (workerId: string, cnicNumber: string) =>
    send('PATCH', `/api/admin/workers/${workerId}/verification/cnic`, { cnicNumber }) as Promise<{
      cnicNumber: string | null
      duplicates: CnicDuplicate[]
    }>,

  approve: (workerId: string) =>
    send('POST', `/api/admin/workers/${workerId}/actions/approve-verification`),

  reject: (
    workerId: string,
    input: { reasonCode: RejectionCode; note: string; allowResubmission: boolean }
  ) => send('POST', `/api/admin/workers/${workerId}/actions/reject-verification`, input),

  requestInfo: (workerId: string, message: string) =>
    send('POST', `/api/admin/workers/${workerId}/actions/request-info`, { message }),
}