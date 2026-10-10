// hooks/useBookings.ts
import useSWR from 'swr'
import { useState } from 'react'
import { fetcher } from '@/lib/swr-fetcher'
import type { BookingStatus } from '@/lib/booking-constants'
import type {
  BookingBoard,
  BookingChatData,
  BookingDetail,
  BookingFilters,
  BookingKpis,
  BookingListResponse,
  BookingLocationData,
  BookingNote,
  BookingPaymentData,
  BookingTimeline,
  ReassignCandidate,
} from '@/types/booking'

export const DEFAULT_BOOKING_FILTERS: BookingFilters = {
  search: '',
  status: 'all',
  city: 'all',
  categoryId: 'all',
  paymentStatus: 'all',
  hasDispute: 'all',
  amountMin: '',
  amountMax: '',
  dateFrom: null,
  dateTo: null,
  sortBy: 'created_at',
  sortDir: 'desc',
  page: 1,
  pageSize: 20,
}

function filterParams(filters: BookingFilters, includeStatus = true): URLSearchParams {
  const qs = new URLSearchParams()
  if (filters.search) qs.set('search', filters.search)
  if (includeStatus && filters.status !== 'all') qs.set('status', filters.status)
  if (filters.city !== 'all') qs.set('city', filters.city)
  if (filters.categoryId !== 'all') qs.set('categoryId', filters.categoryId)
  if (filters.paymentStatus !== 'all') qs.set('paymentStatus', filters.paymentStatus)
  if (filters.hasDispute !== 'all') qs.set('hasDispute', filters.hasDispute)
  if (filters.amountMin) qs.set('amountMin', filters.amountMin)
  if (filters.amountMax) qs.set('amountMax', filters.amountMax)
  if (filters.dateFrom) qs.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) qs.set('dateTo', filters.dateTo)
  return qs
}

function buildQuery(filters: BookingFilters) {
  const qs = filterParams(filters)
  qs.set('sortBy', filters.sortBy)
  qs.set('sortDir', filters.sortDir)
  qs.set('page', String(filters.page))
  qs.set('pageSize', String(filters.pageSize))
  return qs.toString()
}

/** Query string for the CSV export: filters only, no paging/sorting. */
export function buildBookingExportQuery(filters: BookingFilters): string {
  return filterParams(filters).toString()
}

export function useBookingKpis() {
  const { data, error, isLoading, mutate } = useSWR<BookingKpis>(
    '/api/admin/bookings/kpis',
    fetcher,
    { refreshInterval: 30_000 }
  )
  return { kpis: data, isLoading, error, mutate }
}

export function useBookingsList(filters: BookingFilters, enabled = true) {
  const { data, error, isLoading, mutate } = useSWR<BookingListResponse>(
    enabled ? `/api/admin/bookings?${buildQuery(filters)}` : null,
    fetcher,
    { keepPreviousData: true, refreshInterval: 30_000 }
  )
  return { bookings: data, isLoading, error, mutate }
}

export function useBookingBoard(filters: BookingFilters, enabled = true) {
  const { data, error, isLoading, mutate } = useSWR<BookingBoard>(
    enabled ? `/api/admin/bookings/board?${filterParams(filters, false).toString()}` : null,
    fetcher,
    { keepPreviousData: true, refreshInterval: 30_000 }
  )
  return { board: data, isLoading, error, mutate }
}

export function useBookingFilters(initial: Partial<BookingFilters> = {}) {
  const [filters, setFilters] = useState<BookingFilters>({ ...DEFAULT_BOOKING_FILTERS, ...initial })

  function update(patch: Partial<BookingFilters>) {
    // any real filter change resets pagination back to page 1
    const resetsPage = Object.keys(patch).some((k) => k !== 'page')
    setFilters((prev) => ({ ...prev, ...patch, page: resetsPage ? 1 : (patch.page ?? prev.page) }))
  }

  function reset() {
    setFilters(DEFAULT_BOOKING_FILTERS)
  }

  return { filters, update, reset }
}

// ---- Detail ----

export function useBookingDetail(bookingId: string) {
  const { data, error, isLoading, mutate } = useSWR<BookingDetail>(
    bookingId ? `/api/admin/bookings/${bookingId}` : null,
    fetcher,
    { refreshInterval: 30_000 }
  )
  return { booking: data, isLoading, error, mutate }
}

export function useBookingTimeline(bookingId: string) {
  const { data, error, isLoading, mutate } = useSWR<BookingTimeline>(
    bookingId ? `/api/admin/bookings/${bookingId}/timeline` : null,
    fetcher
  )
  return { timeline: data, isLoading, error, mutate }
}

export function useBookingChat(bookingId: string) {
  const { data, error, isLoading, mutate } = useSWR<BookingChatData>(
    bookingId ? `/api/admin/bookings/${bookingId}/chat` : null,
    fetcher
  )
  return { chat: data, isLoading, error, mutate }
}

export function useBookingPayment(bookingId: string) {
  const { data, error, isLoading, mutate } = useSWR<BookingPaymentData>(
    bookingId ? `/api/admin/bookings/${bookingId}/payment` : null,
    fetcher
  )
  return { payment: data, isLoading, error, mutate }
}

export function useBookingLocation(bookingId: string) {
  const { data, error, isLoading, mutate } = useSWR<BookingLocationData>(
    bookingId ? `/api/admin/bookings/${bookingId}/location` : null,
    fetcher
  )
  return { location: data, isLoading, error, mutate }
}

export function useBookingNotes(bookingId: string) {
  const { data, error, isLoading, mutate } = useSWR<BookingNote[]>(
    bookingId ? `/api/admin/bookings/${bookingId}/notes` : null,
    fetcher
  )
  return { notes: data ?? [], isLoading, error, mutate }
}

/** `enabled = false` skips the request (dialog closed, or admin lacks bookings:reassign). */
export function useReassignCandidates(bookingId: string, search: string, enabled: boolean) {
  const { data, error, isLoading } = useSWR<{ data: ReassignCandidate[] }>(
    enabled
      ? `/api/admin/bookings/${bookingId}/reassign-candidates?search=${encodeURIComponent(search)}`
      : null,
    fetcher,
    { keepPreviousData: true }
  )
  return { candidates: data?.data ?? [], isLoading, error }
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

export const bookingActions = {
  cancel: (bookingId: string, input: { reason: string; refundPercent: number }) =>
    send('POST', `/api/admin/bookings/${bookingId}/actions/cancel`, input),
  overrideStatus: (bookingId: string, input: { toStatus: BookingStatus; reason: string }) =>
    send('POST', `/api/admin/bookings/${bookingId}/actions/override-status`, input),
  reassign: (bookingId: string, input: { newWorkerId: string; reason: string }) =>
    send('POST', `/api/admin/bookings/${bookingId}/actions/reassign`, input) as Promise<{
      ok: boolean
      newBookingId: string
    }>,
  escalate: (bookingId: string, input: { reason: string }) =>
    send('POST', `/api/admin/bookings/${bookingId}/actions/escalate`, input),
  addNote: (bookingId: string, note: string) =>
    send('POST', `/api/admin/bookings/${bookingId}/notes`, { note }),
}