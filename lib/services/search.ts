// lib/services/search.ts  (server only)
import { callService, bestEffort, type ServiceTarget } from '@/lib/internal-client'

const target = (): ServiceTarget => ({
  name: 'search-service',
  url: process.env.SEARCH_SERVICE_URL,
  key: process.env.SEARCH_SERVICE_INTERNAL_KEY ?? process.env.INTERNAL_API_KEY,
})

export const searchSvc = {
  /** For changes made by SQL in the panel (featured flag, badges, re-verification). Never throws. */
  reindexWorker: (workerId: string) =>
    bestEffort('search reindex', () => callService(target(), 'POST', `/internal/reindex/${workerId}`)),
}