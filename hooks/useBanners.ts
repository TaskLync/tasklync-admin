import useSWR from 'swr'
import { fetcher } from '@/lib/swr-fetcher'
import { BANNER_PLACEMENT, type BannerState } from '@/lib/banner-constants'
import type { BannerDetail, BannerItem, BannerList, BannerPlacementSettings, BannerTarget } from '@/types/banner'

export function useBannerList(f: { state: BannerState | 'all'; search: string }) {
  const qs = new URLSearchParams({ pageSize: '100' })
  if (f.state !== 'all') qs.set('state', f.state)
  if (f.search.trim()) qs.set('search', f.search.trim())
  const { data, error, isLoading, mutate } = useSWR<BannerList>(`/api/admin/banners?${qs}`, fetcher, {
    keepPreviousData: true, refreshInterval: 60_000,
  })
  return { list: data, error, isLoading, mutate }
}

export function useBannerDetail(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<BannerDetail>(id ? `/api/admin/banners/${id}` : null, fetcher)
  return { banner: data, error, isLoading, mutate }
}

export function usePlacementSettings() {
  const { data, error, isLoading, mutate } = useSWR<BannerPlacementSettings>(
    `/api/admin/banners/placements/${BANNER_PLACEMENT}`, fetcher)
  return { settings: data, error, isLoading, mutate }
}

export function useBannerTargets(type: string | null, search: string, id?: string) {
  const qs = new URLSearchParams({ type: type ?? '', search })
  if (id) qs.set('id', id)
  const { data, isLoading, error } = useSWR<{ data: BannerTarget[] }>(type ? `/api/admin/banners/targets?${qs}` : null, fetcher, {
    keepPreviousData: true,
  })
  return { targets: data?.data ?? [], isLoading, error }
}

async function send<T>(url: string, method: string, body?: object): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(json.error || 'Action failed'), { status: res.status, code: json.code })
  return json as T
}

export const bannerActions = {
  create: (input: object) => send<{ data: BannerItem }>('/api/admin/banners', 'POST', input),
  update: (id: string, input: object) => send<{ data: BannerItem }>(`/api/admin/banners/${id}`, 'PATCH', input),
  remove: (id: string) => send<{ data: { id: string } }>(`/api/admin/banners/${id}`, 'DELETE'),
  publish: (id: string, version: number) => send<{ data: BannerItem }>(`/api/admin/banners/${id}/actions/publish`, 'POST', { version }),
  unpublish: (id: string, version: number) => send<{ data: BannerItem }>(`/api/admin/banners/${id}/actions/unpublish`, 'POST', { version }),
  setEnabled: (id: string, version: number, isEnabled: boolean) =>
    send<{ data: BannerItem }>(`/api/admin/banners/${id}/actions/status`, 'POST', { version, isEnabled }),
  reorder: (ids: string[]) => send<{ data: BannerItem[] }>('/api/admin/banners/reorder', 'PATCH', { ids }),
  updatePlacement: (input: object) =>
    send<{ data: BannerPlacementSettings }>(`/api/admin/banners/placements/${BANNER_PLACEMENT}`, 'PUT', input),
  uploadImage: async (file: File) => {
    const form = new FormData()
    form.append('image', file)
    const res = await fetch('/api/admin/banners/media', { method: 'POST', body: form })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error || 'Upload failed')
    return json.data as { url: string; publicId: string; width: number; height: number }
  },
}
