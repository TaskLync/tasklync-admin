// hooks/useDisputes.ts
import useSWR from 'swr'
import { useState } from 'react'
import { fetcher } from '@/lib/swr-fetcher'
import type { DisputeResolution } from '@/lib/dispute-constants'
import type { ListResponse, RefundRow } from '@/types/payment'
import type {
  DisputeCounts,
  DisputeDetail,
  DisputeFilters,
  DisputeListResponse,
  DisputeNote,
  DisputeRefundFilters,
} from '@/types/dispute'

export const DEFAULT_DISPUTE_FILTERS: DisputeFilters = {
  tab: 'open',
  search: '',
  city: 'all',
  categoryId: 'all',
  assigned: 'all',
  resolution: 'all',
  amountMin: '',
  amountMax: '',
  dateFrom: null,
  dateTo: null,
  page: 1,
  pageSize: 20,
}

export const DEFAULT_DISPUTE_REFUND_FILTERS: DisputeRefundFilters = {
  search: '',
  status: 'all',
  reason: 'all',
  initiatedBy: 'all',
  source: 'dispute',
  dateFrom: null,
  dateTo: null,
  page: 1,
  pageSize: 25,
}

type Primitive = string | number | null | undefined

function toQs(filters: object): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(filters as Record<string, Primitive>)) {
    if (v === null || v === undefined || v === '' || v === 'all') continue
    qs.set(k, String(v))
  }
  return qs.toString()
}

export function useDisputeCounts() {
  const { data, error, isLoading, mutate } = useSWR<DisputeCounts>(
    '/api/admin/disputes/counts',
    fetcher,
    { refreshInterval: 30_000 }
  )
  return { counts: data, isLoading, error, mutate }
}

export function useDisputeList(filters: DisputeFilters) {
  const { data, error, isLoading, mutate } = useSWR<DisputeListResponse>(
    `/api/admin/disputes?${toQs(filters)}`,
    fetcher,
    { keepPreviousData: true, refreshInterval: 60_000 }
  )
  return { disputes: data, isLoading, error, mutate }
}

export function useDisputeFilters(initial: Partial<DisputeFilters> = {}) {
  const [filters, setFilters] = useState<DisputeFilters>({ ...DEFAULT_DISPUTE_FILTERS, ...initial })

  function update(patch: Partial<DisputeFilters>) {
    // any real change (tab, search, city...) resets pagination to page 1
    const resetsPage = Object.keys(patch).some((k) => k !== 'page')
    setFilters((prev) => ({ ...prev, ...patch, page: resetsPage ? 1 : (patch.page ?? prev.page) }))
  }

  function reset() {
    setFilters((prev) => ({ ...DEFAULT_DISPUTE_FILTERS, tab: prev.tab }))
  }

  return { filters, update, reset }
}

export function useDisputeDetail(disputeId: string) {
  const { data, error, isLoading, mutate } = useSWR<DisputeDetail>(
    disputeId ? `/api/admin/disputes/${disputeId}` : null,
    fetcher,
    { refreshInterval: 30_000 }
  )
  return { dispute: data, isLoading, error, mutate }
}

export function useDisputeNotes(disputeId: string) {
  const { data, error, isLoading, mutate } = useSWR<DisputeNote[]>(
    disputeId ? `/api/admin/disputes/${disputeId}/notes` : null,
    fetcher
  )
  return { notes: data ?? [], isLoading, error, mutate }
}

export function useDisputeRefunds(filters: DisputeRefundFilters) {
  const { data, error, isLoading, mutate } = useSWR<ListResponse<RefundRow>>(
    `/api/admin/disputes/refunds?${toQs(filters)}`,
    fetcher,
    { keepPreviousData: true, refreshInterval: 60_000 }
  )
  return { refunds: data, isLoading, error, mutate }
}

// --- Mutations ---

async function send(method: 'POST', url: string, body?: object) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Action failed')
  return json
}

export const disputeActions = {
  assign: (disputeId: string, action: 'claim' | 'release') =>
    send('POST', `/api/admin/disputes/${disputeId}/actions/assign`, { action }),

  escalate: (disputeId: string, input: { note: string }) =>
    send('POST', `/api/admin/disputes/${disputeId}/actions/escalate`, input),

  resolve: (
    disputeId: string,
    input: {
      resolution: DisputeResolution
      /** Only read by the server for PARTIAL_REFUND. */
      refundAmount?: number
      note: string
      overrideWindow?: boolean
    }
  ) => send('POST', `/api/admin/disputes/${disputeId}/actions/resolve`, input),

  addNote: (disputeId: string, note: string) =>
    send('POST', `/api/admin/disputes/${disputeId}/notes`, { note }),
}