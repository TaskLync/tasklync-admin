// hooks/usePayments.ts
import useSWR from 'swr'
import { useState } from 'react'
import { fetcher } from '@/lib/swr-fetcher'
import type {
  ListResponse,
  OverviewPeriod,
  PaymentOverview,
  PayoutFilters,
  PayoutRow,
  RefundFilters,
  RefundRow,
  RevenueSeries,
  TransactionFilters,
  TransactionList,
} from '@/types/payment'

export const DEFAULT_TRANSACTION_FILTERS: TransactionFilters = {
  search: '',
  status: 'all',
  method: 'all',
  city: 'all',
  amountMin: '',
  amountMax: '',
  dateFrom: null,
  dateTo: null,
  page: 1,
  pageSize: 25,
}

export const DEFAULT_PAYOUT_FILTERS: PayoutFilters = {
  search: '',
  status: 'all',
  method: 'all',
  dateFrom: null,
  dateTo: null,
  page: 1,
  pageSize: 25,
}

export const DEFAULT_REFUND_FILTERS: RefundFilters = {
  search: '',
  status: 'all',
  reason: 'all',
  initiatedBy: 'all',
  dateFrom: null,
  dateTo: null,
  page: 1,
  pageSize: 25,
}

type Primitive = string | number | null | undefined

function toQs(filters: object, omit: string[] = []): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(filters as Record<string, Primitive>)) {
    if (omit.includes(k) || v === null || v === undefined || v === '' || v === 'all') continue
    qs.set(k, String(v))
  }
  return qs.toString()
}

/** Filters only (no paging): used by the CSV export links. */
export const buildExportQuery = (filters: object) => toQs(filters, ['page', 'pageSize'])

/** One filter-state hook for all three tables. Any real change resets to page 1. */
export function useFilterState<T extends { page: number }>(defaults: T, initial: Partial<T> = {}) {
  const [filters, setFilters] = useState<T>({ ...defaults, ...initial })

  function update(patch: Partial<T>) {
    const resetsPage = Object.keys(patch).some((k) => k !== 'page')
    setFilters((prev) => ({ ...prev, ...patch, page: resetsPage ? 1 : (patch.page ?? prev.page) }))
  }

  function reset() {
    setFilters(defaults)
  }

  return { filters, update, reset }
}

export function usePaymentOverview(period: OverviewPeriod) {
  const { data, error, isLoading, mutate } = useSWR<PaymentOverview>(
    `/api/admin/payments/overview?period=${period}`,
    fetcher,
    { refreshInterval: 60_000, keepPreviousData: true }
  )
  return { overview: data, isLoading, error, mutate }
}

export function useRevenueSeries(days: 30 | 90) {
  const { data, error, isLoading } = useSWR<RevenueSeries>(
    `/api/admin/payments/revenue?days=${days}`,
    fetcher,
    { refreshInterval: 60_000, keepPreviousData: true }
  )
  return { series: data, isLoading, error }
}

export function useTransactions(filters: TransactionFilters) {
  const { data, error, isLoading, mutate } = useSWR<TransactionList>(
    `/api/admin/payments/transactions?${toQs(filters)}`,
    fetcher,
    { keepPreviousData: true, refreshInterval: 60_000 }
  )
  return { transactions: data, isLoading, error, mutate }
}

export function usePayouts(filters: PayoutFilters) {
  const { data, error, isLoading, mutate } = useSWR<ListResponse<PayoutRow>>(
    `/api/admin/payments/payouts?${toQs(filters)}`,
    fetcher,
    { keepPreviousData: true, refreshInterval: 60_000 }
  )
  return { payouts: data, isLoading, error, mutate }
}

export function useRefunds(filters: RefundFilters) {
  const { data, error, isLoading, mutate } = useSWR<ListResponse<RefundRow>>(
    `/api/admin/payments/refunds?${toQs(filters)}`,
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

export const paymentActions = {
  refund: (input: { paymentId: string; amount: number; reason: string }) =>
    send('POST', '/api/admin/payments/refunds', input),
  retryPayout: (payoutId: string) =>
    send('POST', `/api/admin/payments/payouts/${payoutId}/retry`),
}