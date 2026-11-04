import useSWR from 'swr'
import { useState } from 'react'
import { fetcher } from '@/lib/swr-fetcher'
import type { CouponDetail, CouponFilters, CouponList, CouponRedemptionRow } from '@/types/coupon'

export const DEFAULT_COUPON_FILTERS: CouponFilters = { search: '', status: 'all', page: 1, pageSize: 20 }

export function useCouponFilters() {
  const [filters, setFilters] = useState<CouponFilters>(DEFAULT_COUPON_FILTERS)
  const update = (patch: Partial<CouponFilters>) =>
    setFilters((p) => ({ ...p, ...patch, page: Object.keys(patch).some((k) => k !== 'page') ? 1 : (patch.page ?? p.page) }))
  return { filters, update, reset: () => setFilters(DEFAULT_COUPON_FILTERS) }
}

export function useCouponList(f: CouponFilters) {
  const qs = new URLSearchParams({ page: String(f.page), pageSize: String(f.pageSize) })
  if (f.search) qs.set('search', f.search)
  if (f.status !== 'all') qs.set('status', f.status)
  const { data, error, isLoading, mutate } = useSWR<CouponList>(`/api/admin/coupons?${qs}`, fetcher, {
    keepPreviousData: true, refreshInterval: 30_000,
  })
  return { coupons: data, error, isLoading, mutate }
}

export function useCouponDetail(id: string) {
  const { data, error, isLoading, mutate } = useSWR<CouponDetail>(id ? `/api/admin/coupons/${id}` : null, fetcher, { refreshInterval: 30_000 })
  return { coupon: data, error, isLoading, mutate }
}

export function useCouponRedemptions(id: string) {
  const { data, error, isLoading } = useSWR<{ data: CouponRedemptionRow[] }>(id ? `/api/admin/coupons/${id}/redemptions` : null, fetcher)
  return { rows: data?.data ?? [], error, isLoading }
}

async function send(url: string, body: object) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Action failed')
  return json
}

export const couponActions = {
  create: (input: object) => send('/api/admin/coupons', input),
  batch: (input: object) => send('/api/admin/coupons/batch', input) as Promise<{ batchId: string; count: number; codes: string[] }>,
  act: (id: string, action: string, body: { reason?: string; endsAt?: string } = {}) =>
    send(`/api/admin/coupons/${id}/actions/${action}`, body),
}