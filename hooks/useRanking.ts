import useSWR from 'swr'
import { fetcher } from '@/lib/swr-fetcher'
import { usePermission } from '@/hooks/usePermission'
import type { RankingConfig, RankingOverride, SimResult, WorkerRanking } from '@/types/ranking'

export function useRankingConfigs() {
  const { data, error, isLoading, mutate } = useSWR<{ data: RankingConfig[] }>('/api/admin/ranking/configs', fetcher, {
    refreshInterval: 60_000,
  })
  return { configs: data?.data ?? [], error, isLoading, mutate }
}

export function useRankingOverrides() {
  const { data, error, isLoading, mutate } = useSWR<{ data: RankingOverride[] }>('/api/admin/ranking/overrides', fetcher)
  return { overrides: data?.data ?? [], error, isLoading, mutate }
}

export function useWorkerRanking(workerId: string) {
  const allowed = usePermission('ranking:view')
  const { data, error, isLoading, mutate } = useSWR<WorkerRanking>(
    allowed && workerId ? `/api/admin/workers/${workerId}/ranking` : null, fetcher, { refreshInterval: 60_000 }
  )
  return { ranking: data, allowed, error, isLoading, mutate }
}

async function call(method: 'POST' | 'DELETE', url: string, body?: object) {
  const res = await fetch(url, {
    method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Action failed')
  return json
}

export const rankingActions = {
  createConfig: (input: object) => call('POST', '/api/admin/ranking/configs', input) as Promise<{ version: number }>,
  activate: (version: number, note: string) => call('POST', `/api/admin/ranking/configs/${version}/activate`, { note }),
  shadow: (version: number, enabled: boolean, samplePct = 5) =>
    call('POST', `/api/admin/ranking/configs/${version}/shadow`, { enabled, samplePct }),
  upsertOverride: (input: object) => call('POST', '/api/admin/ranking/overrides', input),
  removeOverride: (id: string) => call('DELETE', `/api/admin/ranking/overrides/${id}`),
  simulate: (input: object) => call('POST', '/api/admin/ranking/simulate', input) as Promise<{ data: SimResult }>,
  flag: (workerId: string, input: object) => call('POST', `/api/admin/workers/${workerId}/ranking-flags`, input),
}