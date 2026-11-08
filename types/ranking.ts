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

export interface ExplainTerm {
  term: string
  applies: boolean
  notAppliedReason: 'NO_SEARCH_TEXT' | 'NO_LOCATION' | 'WEIGHT_ZERO' | null
  value: number | null
  weight: number
  weightShare: number
  points: number
}
export interface ExplainGate { key: 'quality' | 'reliability' | 'relevance'; value: number | null; min: number; pass: boolean }
export interface ExplainReason { code: string; severity: 'positive' | 'negative' | 'info'; detail: number | string | null }

export interface RankingExplain {
  worker: {
    id: string; name: string | null; businessName: string | null; city: string | null; providerType: string
    avgRating: number; totalReviews: number; totalBookings: number; isFeatured: boolean; badges: string[]
    isOnJob: boolean; responseTimeMins: number; lastSeenAt: string | null; indexedAt: string | null
  }
  context: {
    q: string | null; categoryId: string | null; city: string | null; hasLocation: boolean; radius: number | null
    rankingVersion: number; overridesApplied: boolean; fallbackConfig: boolean
  }
  eligibility: { visible: boolean; matchesFilters: boolean }
  terms: ExplainTerm[]
  weighted: { points: number; fallbackUsed: boolean }
  multipliers: { quality: number; reliability: number; flag: number; product: number }
  afterFloors: number
  boost: {
    featured: number; topRated: number; backgroundVerified: number
    promotion: { points: number; bestPct: number; until: string | null }
    rawTotal: number; cap: number; cappedTotal: number; gates: ExplainGate[]; gatePass: boolean; applied: number
  }
  finalScore: number
  checkDelta: number
  rank: { scoreOrder: number | null; afterDiversity: number | null; scanned: number; totalMatching: number; moved: boolean } | null
  performance: {
    hasData: boolean; updatedAt: string | null
    acceptedD: number; rejectedD: number; expiredD: number; completedD: number; workerCancelD: number; noShowD: number
    ratingNd: number; highNd: number
    acceptanceRate: number | null; completionRate: number | null; cancelNoShowRate: number | null; highRatingShare: number | null
    jobsDone: number; repeatRate: number; rankingMultiplier: number
  }
  reasonCodes: ExplainReason[]
}