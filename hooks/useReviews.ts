// hooks/useReviews.ts
import useSWR from 'swr'
import { useState } from 'react'
import { fetcher } from '@/lib/swr-fetcher'
import type { ModerationAction } from '@/lib/review-constants'
import type {
  AuditFilters,
  AuditListResponse,
  ReviewCounts,
  ReviewDetail,
  ReviewFilters,
  ReviewListResponse,
  ReviewNote,
} from '@/types/review'

export const DEFAULT_REVIEW_FILTERS: ReviewFilters = {
  tab: 'flagged',
  search: '',
  rating: 'all',
  city: 'all',
  categoryId: 'all',
  status: 'all',
  signal: 'all',
  workerId: '',
  userId: '',
  dateFrom: null,
  dateTo: null,
  page: 1,
  pageSize: 20,
}

export const DEFAULT_AUDIT_FILTERS: AuditFilters = {
  flag: 'all',
  city: 'all',
  search: '',
  page: 1,
  pageSize: 20,
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

export function useReviewCounts() {
  const { data, error, isLoading, mutate } = useSWR<ReviewCounts>(
    '/api/admin/reviews/counts',
    fetcher,
    { refreshInterval: 30_000 }
  )
  return { counts: data, isLoading, error, mutate }
}

export function useReviewList(filters: ReviewFilters) {
  const { data, error, isLoading, mutate } = useSWR<ReviewListResponse>(
    `/api/admin/reviews?${toQs(filters)}`,
    fetcher,
    { keepPreviousData: true, refreshInterval: 60_000 }
  )
  return { reviews: data, isLoading, error, mutate }
}

export function useReviewFilters(initial: Partial<ReviewFilters> = {}) {
  const [filters, setFilters] = useState<ReviewFilters>({ ...DEFAULT_REVIEW_FILTERS, ...initial })

  function update(patch: Partial<ReviewFilters>) {
    // any real change (search, rating, city...) resets pagination to page 1
    const resetsPage = Object.keys(patch).some((k) => k !== 'page')
    setFilters((prev) => ({ ...prev, ...patch, page: resetsPage ? 1 : (patch.page ?? prev.page) }))
  }

  function reset() {
    setFilters((prev) => ({ ...DEFAULT_REVIEW_FILTERS, tab: prev.tab }))
  }

  return { filters, update, reset }
}

export function useReviewAudit(filters: AuditFilters) {
  const { data, error, isLoading, mutate } = useSWR<AuditListResponse>(
    `/api/admin/reviews/audit?${toQs(filters)}`,
    fetcher,
    { keepPreviousData: true }
  )
  return { audit: data, isLoading, error, mutate }
}

export function useAuditFilters() {
  const [filters, setFilters] = useState<AuditFilters>(DEFAULT_AUDIT_FILTERS)

  function update(patch: Partial<AuditFilters>) {
    const resetsPage = Object.keys(patch).some((k) => k !== 'page')
    setFilters((prev) => ({ ...prev, ...patch, page: resetsPage ? 1 : (patch.page ?? prev.page) }))
  }

  function reset() {
    setFilters(DEFAULT_AUDIT_FILTERS)
  }

  return { filters, update, reset }
}

export function useReviewDetail(reviewId: string) {
  const { data, error, isLoading, mutate } = useSWR<ReviewDetail>(
    reviewId ? `/api/admin/reviews/${reviewId}` : null,
    fetcher,
    { refreshInterval: 30_000 }
  )
  return { review: data, isLoading, error, mutate }
}

export function useReviewNotes(reviewId: string) {
  const { data, error, isLoading, mutate } = useSWR<ReviewNote[]>(
    reviewId ? `/api/admin/reviews/${reviewId}/notes` : null,
    fetcher
  )
  return { notes: data ?? [], isLoading, error, mutate }
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

export const reviewActions = {
  moderate: (reviewId: string, input: { action: ModerationAction; note: string }) =>
    send('POST', `/api/admin/reviews/${reviewId}/actions/moderate`, input),

  addNote: (reviewId: string, note: string) =>
    send('POST', `/api/admin/reviews/${reviewId}/notes`, { note }),
}