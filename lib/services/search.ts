// lib/services/search.ts  (server only)
import { callService, bestEffort, type ServiceTarget } from '@/lib/internal-client'
import type { AdminIdentity } from '@/lib/services/booking'

const target = (): ServiceTarget => ({
  name: 'search-service',
  url: process.env.SEARCH_SERVICE_URL,
  key: process.env.SEARCH_SERVICE_INTERNAL_KEY ?? process.env.INTERNAL_API_KEY,
})

const who = (a: AdminIdentity) => ({ admin_id: a.id, admin_email: a.email })

export const searchSvc = {
  /** For changes made by SQL in the panel (featured flag, badges, re-verification). Never throws. */
  reindexWorker: (workerId: string) =>
    bestEffort('search reindex', () => callService(target(), 'POST', `/internal/reindex/${workerId}`)),
}

/** Ranking policy. search-service is the single writer of search_ranking_* tables (master plan D8). */
export const rankingSvc = {
  configs: () => callService<unknown[]>(target(), 'GET', '/internal/ranking/configs'),
  createConfig: (admin: AdminIdentity, body: object) =>
    callService<{ version: number }>(target(), 'POST', '/internal/ranking/configs', { body: { ...who(admin), ...body } }),
  activate: (version: number, admin: AdminIdentity, note: string) =>
    callService(target(), 'POST', `/internal/ranking/configs/${version}/activate`, { body: { ...who(admin), note } }),
  shadow: (version: number, enabled: boolean, samplePct: number) =>
    callService(target(), 'POST', `/internal/ranking/configs/${version}/shadow`, {
      body: { enabled, sample_pct: samplePct },
    }),
  overrides: () => callService<unknown[]>(target(), 'GET', '/internal/ranking/overrides'),
  upsertOverride: (admin: AdminIdentity, body: object) =>
    callService<{ id: string }>(target(), 'POST', '/internal/ranking/overrides', { body: { ...who(admin), ...body } }),
  removeOverride: (id: string) => callService(target(), 'DELETE', `/internal/ranking/overrides/${id}`),
  simulate: (body: object) =>
    callService(target(), 'POST', '/internal/ranking/simulate', { body, timeoutMs: 60_000 }),
  /** Read only: why one worker ranks where they do. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  explain: (query: Record<string, string | number | undefined>) =>
    callService<Record<string, any>>(target(), 'GET', '/internal/ranking/explain', { query, timeoutMs: 30_000 }),
}