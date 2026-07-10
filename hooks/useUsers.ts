// hooks/useUsers.ts
import useSWR from 'swr'
import { useState } from 'react'
import { fetcher } from '@/lib/swr-fetcher'
import type {
  UserListResponse, UserFilters, UserDetail, UserAddress,
  BlockedWorker, AvailabilityAwareList, UserBookingRow, UserReviewRow, UserReportRow,
} from '@/types/user'

export interface UserKpis {
  totalUsers: number
  signupsToday: number
  signupsTodayChangePct: number | null
  activeUsers: number
  suspendedOrBanned: number
  signupsSparkline7d: number[]
}

export const DEFAULT_USER_FILTERS: UserFilters = {
  search: '',
  city: 'all',
  status: 'all',
  bookingsBucket: 'all',
  hasDispute: 'all',
  dateFrom: null,
  dateTo: null,
  sortBy: 'created_at',
  sortDir: 'desc',
  page: 1,
  pageSize: 20,
}

function buildQuery(filters: UserFilters) {
  const qs = new URLSearchParams()
  if (filters.search) qs.set('search', filters.search)
  if (filters.city !== 'all') qs.set('city', filters.city)
  if (filters.status !== 'all') qs.set('status', filters.status)
  if (filters.bookingsBucket !== 'all') qs.set('bookingsBucket', filters.bookingsBucket)
  if (filters.hasDispute !== 'all') qs.set('hasDispute', filters.hasDispute)
  if (filters.dateFrom) qs.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) qs.set('dateTo', filters.dateTo)
  qs.set('sortBy', filters.sortBy)
  qs.set('sortDir', filters.sortDir)
  qs.set('page', String(filters.page))
  qs.set('pageSize', String(filters.pageSize))
  return qs.toString()
}

export function useUserKpis() {
  const { data, error, isLoading } = useSWR<UserKpis>('/api/admin/users/kpis', fetcher)
  return { kpis: data, isLoading, error }
}

export function useUsersList(filters: UserFilters) {
  const { data, error, isLoading, mutate } = useSWR<UserListResponse>(
    `/api/admin/users?${buildQuery(filters)}`,
    fetcher,
    { keepPreviousData: true }
  )
  return { users: data, isLoading, error, mutate }
}

export function useUserFilters(initial: Partial<UserFilters> = {}) {
  const [filters, setFilters] = useState<UserFilters>({ ...DEFAULT_USER_FILTERS, ...initial })

  function update(patch: Partial<UserFilters>) {
    // any real filter change resets pagination back to page 1
    const resetsPage = Object.keys(patch).some((k) => k !== 'page')
    setFilters((prev) => ({ ...prev, ...patch, page: resetsPage ? 1 : (patch.page ?? prev.page) }))
  }

  function reset() {
    setFilters(DEFAULT_USER_FILTERS)
  }

  return { filters, update, reset }
}

export function useUserDetail(userId: string) {
  const { data, error, isLoading, mutate } = useSWR<UserDetail>(
    userId ? `/api/admin/users/${userId}` : null,
    fetcher
  )
  return { user: data, isLoading, error, mutate }
}

export function useUserAddresses(userId: string) {
  const { data, error, isLoading, mutate } = useSWR<UserAddress[]>(
    userId ? `/api/admin/users/${userId}/addresses` : null,
    fetcher
  )
  return { addresses: data ?? [], isLoading, error, mutate }
}

export function useUserBlockedWorkers(userId: string) {
  const { data, error, isLoading, mutate } = useSWR<BlockedWorker[]>(
    userId ? `/api/admin/users/${userId}/blocked-workers` : null,
    fetcher
  )
  return { blockedWorkers: data ?? [], isLoading, error, mutate }
}

export function useUserBookings(userId: string) {
  const { data, error, isLoading, mutate } = useSWR<AvailabilityAwareList<UserBookingRow>>(
    userId ? `/api/admin/users/${userId}/bookings` : null,
    fetcher
  )
  return { bookings: data?.data ?? [], available: data?.available ?? true, isLoading, error, mutate }
}

export function useUserReviews(userId: string) {
  const { data, error, isLoading, mutate } = useSWR<AvailabilityAwareList<UserReviewRow>>(
    userId ? `/api/admin/users/${userId}/reviews` : null,
    fetcher
  )
  return { reviews: data?.data ?? [], available: data?.available ?? true, isLoading, error, mutate }
}

export function useUserReports(userId: string) {
  const { data, error, isLoading, mutate } = useSWR<AvailabilityAwareList<UserReportRow>>(
    userId ? `/api/admin/users/${userId}/reports` : null,
    fetcher
  )
  return { reports: data?.data ?? [], available: data?.available ?? true, isLoading, error, mutate }
}

// --- Mutations ---

async function postAction(url: string, body?: object) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Action failed')
  return json
}

export const userActions = {
  warn: (userId: string, reason: string) =>
    postAction(`/api/admin/users/${userId}/actions/warn`, { reason }),
  suspend: (userId: string, reason: string, duration: '7d' | '30d' | 'custom', until?: string) =>
    postAction(`/api/admin/users/${userId}/actions/suspend`, { reason, duration, until }),
  unsuspend: (userId: string) =>
    postAction(`/api/admin/users/${userId}/actions/unsuspend`),
  ban: (userId: string, reason: string) =>
    postAction(`/api/admin/users/${userId}/actions/ban`, { reason }),
  editContact: async (userId: string, phone?: string, email?: string) => {
    const res = await fetch(`/api/admin/users/${userId}/actions/edit-contact`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, email }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Update failed')
    return json
  },
  impersonate: (userId: string) =>
    postAction(`/api/admin/users/${userId}/actions/impersonate`),
}