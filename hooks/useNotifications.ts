// hooks/useNotifications.ts
import useSWR from 'swr'
import { useEffect, useState } from 'react'
import { fetcher } from '@/lib/swr-fetcher'
import type { BroadcastCategory } from '@/lib/notification-constants'
import type {
  AudienceEstimate,
  AudienceSelection,
  CampaignDetail,
  CampaignFilters,
  CampaignListResponse,
  LaunchRequest,
  LaunchResponse,
  NotificationKpis,
  ResolveResult,
} from '@/types/notification'

export const DEFAULT_CAMPAIGN_FILTERS: CampaignFilters = {
  search: '',
  status: 'all',
  segmentType: 'all',
  page: 1,
  pageSize: 20,
}

function toQs(filters: object): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(filters as Record<string, string | number | null | undefined>)) {
    if (v === null || v === undefined || v === '' || v === 'all') continue
    qs.set(k, String(v))
  }
  return qs.toString()
}

export function useNotificationKpis() {
  const { data, error, isLoading, mutate } = useSWR<NotificationKpis>(
    '/api/admin/notifications/kpis',
    fetcher,
    { refreshInterval: 30_000 }
  )
  return { kpis: data, isLoading, error, mutate }
}

export function useCampaignList(filters: CampaignFilters) {
  const { data, error, isLoading, mutate } = useSWR<CampaignListResponse>(
    `/api/admin/notifications/campaigns?${toQs(filters)}`,
    fetcher,
    { keepPreviousData: true, refreshInterval: 30_000 }
  )
  return { campaigns: data, isLoading, error, mutate }
}

export function useCampaignDetail(campaignId: string) {
  const { data, error, isLoading, mutate } = useSWR<CampaignDetail>(
    campaignId ? `/api/admin/notifications/campaigns/${campaignId}` : null,
    fetcher,
    // poll fast while the job is still sending
    { refreshInterval: (d) => (d?.status === 'SENDING' ? 5_000 : 30_000) }
  )
  return { campaign: data, isLoading, error, mutate }
}

/** Debounced reach estimate for the composer. */
export function useAudienceEstimate(audience: AudienceSelection | null, category: BroadcastCategory) {
  const [state, setState] = useState<{
    estimate: AudienceEstimate | null
    loading: boolean
    error: string | null
  }>({ estimate: null, loading: false, error: null })

  const key = audience ? JSON.stringify({ audience, category }) : null

  useEffect(() => {
    if (!key) {
      setState({ estimate: null, loading: false, error: null })
      return
    }
    const ctrl = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/admin/notifications/audience/estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: key,
          signal: ctrl.signal,
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || 'Could not estimate reach')
        setState({ estimate: json, loading: false, error: null })
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        setState({ estimate: null, loading: false, error: (e as Error).message })
      }
    }, 400)

    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [key])

  return state
}

// --- Mutations ---

async function post<T>(url: string, body: object): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Action failed')
  return json as T
}

export const notificationActions = {
  launch: (input: LaunchRequest) => post<LaunchResponse>('/api/admin/notifications/broadcasts', input),
  resolveRecipients: (audience: 'users' | 'workers', identifiers: string[]) =>
    post<ResolveResult>('/api/admin/notifications/audience/resolve', { audience, identifiers }),
}