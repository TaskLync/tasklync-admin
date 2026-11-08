import useSWR from 'swr'
import { useState } from 'react'
import { fetcher } from '@/lib/swr-fetcher'
import type { PromotionDetail, PromotionFilters, PromotionList, PromotionSettings } from '@/types/promotion'

export const DEFAULT_PROMOTION_FILTERS: PromotionFilters = { search: '', status: 'all', page: 1, pageSize: 20 }

export function usePromotionFilters() {
  const [filters, setFilters] = useState<PromotionFilters>(DEFAULT_PROMOTION_FILTERS)
  const update = (patch: Partial<PromotionFilters>) =>
    setFilters((p) => ({ ...p, ...patch, page: Object.keys(patch).some((k) => k !== 'page') ? 1 : (patch.page ?? p.page) }))
  return { filters, update, reset: () => setFilters(DEFAULT_PROMOTION_FILTERS) }
}

export function usePromotionList(f: PromotionFilters) {
  const qs = new URLSearchParams({ page: String(f.page), pageSize: String(f.pageSize) })
  if (f.search) qs.set('search', f.search)
  if (f.status !== 'all') qs.set('status', f.status)
  const { data, error, isLoading, mutate } = useSWR<PromotionList>(`/api/admin/promotions?${qs}`, fetcher, {
    keepPreviousData: true, refreshInterval: 30_000,
  })
  return { promotions: data, error, isLoading, mutate }
}

export function usePendingPromotionCount() {
  const { data } = useSWR<PromotionList>('/api/admin/promotions?status=PENDING_APPROVAL&page=1&pageSize=1', fetcher, {
    refreshInterval: 30_000,
  })
  return data?.total ?? 0
}

export function usePromotionDetail(id: string) {
  const { data, error, isLoading, mutate } = useSWR<PromotionDetail>(id ? `/api/admin/promotions/${id}` : null, fetcher, {
    refreshInterval: 30_000,
  })
  return { promotion: data, error, isLoading, mutate }
}

export function usePromotionSettings() {
  const { data, error, isLoading, mutate } = useSWR<PromotionSettings>('/api/admin/promotions/settings', fetcher)
  return { settings: data, error, isLoading, mutate }
}

async function send(method: 'POST' | 'PUT', url: string, body: object) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Action failed')
  return json
}

export const promotionActions = {
  act: (id: string, action: string, body: { reason?: string } = {}) =>
    send('POST', `/api/admin/promotions/${id}/actions/${action}`, body),
  saveSettings: (input: object) => send('PUT', '/api/admin/promotions/settings', input),
}