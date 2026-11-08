export interface RankingConfig {
  version: number
  weights: Record<string, number>
  params: Record<string, unknown>
  priorMean: number
  priorWeight: number
  isActive: boolean
  shadowEnabled: boolean
  shadowSamplePct: number
  note: string | null
  createdBy: string | null
  createdAt: string | null
  activatedBy: string | null
  activatedAt: string | null
}

export interface RankingOverride {
  id: string
  scopeType: 'CATEGORY' | 'CITY'
  scopeValue: string
  patch: { weights?: Record<string, number>; params?: Record<string, unknown> }
  note: string | null
  createdAt: string | null
}

export interface SimRow { rank: number; worker_id: string; name: string | null; score: number; boosted: boolean }
export interface SimResult {
  active_version: number
  summary: { queries: number; avg_overlap_at_n: number }
  results: {
    query: { q?: string; categoryId?: string; city?: string }
    active: SimRow[]
    candidate: SimRow[]
    overlap: number
    moved: { worker_id: string; name: string | null; from: number | null; to: number }[]
  }[]
}

export interface WorkerRanking {
  worker: { id: string; name: string | null; totalBookings: number; avgRating: number; totalReviews: number }
  stats: {
    acceptedD: number; rejectedD: number; expiredD: number; completedD: number; workerCancelD: number
    noShowD: number; disputedD: number; ratingNd: number; highNd: number; responseAvgSecs: number | null
    completedTotal: number; distinctCustomers: number; repeatRate: number; rankingMultiplier: number
    flagTypes: string[]; halfLifeDays: number; computedAt: string | null
  } | null
  flags: {
    id: string; flagType: string; multiplier: number; reason: string; source: 'ADMIN' | 'SYSTEM'
    createdByEmail: string | null; createdAt: string; expiresAt: string | null; revokedAt: string | null
  }[]
  daily: {
    day: string; offered: number; accepted: number; rejected: number; expired: number; completed: number
    cancelledByWorker: number; cancelledByCustomer: number; noShow: number; disputed: number
  }[]
  topCustomers: { completedCount: number; lastCompletedAt: string; share: number }[]
}