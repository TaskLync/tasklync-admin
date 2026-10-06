// hooks/useCategories.ts
import useSWR from 'swr'
import { useState } from 'react'
import { fetcher } from '@/lib/swr-fetcher'
import type {
  CategoryListResponse, CategoryFilters, CategoryKpis, CategoryDetail,
  CategoryFormInput, ServiceItem, ServiceFormInput, PricingConfig, PricingConfigInput,
} from '@/types/category'

export const DEFAULT_CATEGORY_FILTERS: CategoryFilters = {
  search: '',
  status: 'all',
  sortBy: 'sort_order',
  sortDir: 'asc',
  page: 1,
  pageSize: 20,
}

function buildQuery(filters: CategoryFilters) {
  const qs = new URLSearchParams()
  if (filters.search) qs.set('search', filters.search)
  if (filters.status !== 'all') qs.set('status', filters.status)
  qs.set('sortBy', filters.sortBy)
  qs.set('sortDir', filters.sortDir)
  qs.set('page', String(filters.page))
  qs.set('pageSize', String(filters.pageSize))
  return qs.toString()
}

export function useCategoryKpis() {
  const { data, error, isLoading } = useSWR<CategoryKpis>('/api/admin/categories/kpis', fetcher)
  return { kpis: data, isLoading, error }
}

export function useCategoriesList(filters: CategoryFilters) {
  const { data, error, isLoading, mutate } = useSWR<CategoryListResponse>(
    `/api/admin/categories?${buildQuery(filters)}`,
    fetcher,
    { keepPreviousData: true }
  )
  return { categories: data, isLoading, error, mutate }
}

export function useCategoryFilters(initial: Partial<CategoryFilters> = {}) {
  const [filters, setFilters] = useState<CategoryFilters>({ ...DEFAULT_CATEGORY_FILTERS, ...initial })

  function update(patch: Partial<CategoryFilters>) {
    const resetsPage = Object.keys(patch).some((k) => k !== 'page')
    setFilters((prev) => ({ ...prev, ...patch, page: resetsPage ? 1 : (patch.page ?? prev.page) }))
  }
  function reset() {
    setFilters(DEFAULT_CATEGORY_FILTERS)
  }
  return { filters, update, reset }
}

export function useCategoryDetail(categoryId: string) {
  const { data, error, isLoading, mutate } = useSWR<CategoryDetail>(
    categoryId ? `/api/admin/categories/${categoryId}` : null,
    fetcher
  )
  return { category: data, isLoading, error, mutate }
}

export function useCategoryServices(categoryId: string) {
  const { data, error, isLoading, mutate } = useSWR<ServiceItem[]>(
    categoryId ? `/api/admin/categories/${categoryId}/services` : null,
    fetcher
  )
  return { services: data ?? [], isLoading, error, mutate }
}

export function usePricingConfig() {
  const { data, error, isLoading, mutate } = useSWR<PricingConfig>('/api/admin/pricing-config', fetcher)
  return { config: data, isLoading, error, mutate }
}

// --- Mutations ---

async function sendAction(url: string, method: 'POST' | 'PATCH', body?: object) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Action failed')
  return json
}

export const categoryActions = {
  create: (input: CategoryFormInput) =>
    sendAction('/api/admin/categories', 'POST', input),
  update: (categoryId: string, input: CategoryFormInput) =>
    sendAction(`/api/admin/categories/${categoryId}`, 'PATCH', input),
  toggleActive: (categoryId: string, isActive: boolean) =>
    sendAction(`/api/admin/categories/${categoryId}/actions/toggle-active`, 'POST', { isActive }),
}

export const serviceActions = {
  create: (categoryId: string, input: ServiceFormInput) =>
    sendAction(`/api/admin/categories/${categoryId}/services`, 'POST', input),
  update: (categoryId: string, serviceId: string, input: ServiceFormInput) =>
    sendAction(`/api/admin/categories/${categoryId}/services/${serviceId}`, 'PATCH', input),
  toggleActive: (categoryId: string, serviceId: string, isActive: boolean) =>
    sendAction(
      `/api/admin/categories/${categoryId}/services/${serviceId}/actions/toggle-active`,
      'POST',
      { isActive }
    ),
}

export const pricingConfigActions = {
  update: (input: PricingConfigInput) =>
    sendAction('/api/admin/pricing-config', 'PATCH', input),
}