// lib/ranking-api.ts (server only)
import { z } from 'zod'
import { FLAG_TYPES, RANKING_TERMS } from '@/lib/ranking-constants'
import type { RankingConfig, RankingExplain, RankingOverride, WorkerRanking } from '@/types/ranking'

const termShape = Object.fromEntries(RANKING_TERMS.map((t) => [t, z.number().min(0).max(1)])) as Record<string, z.ZodNumber>

/** search-service validates with a STRICT object that needs all 13 terms, so we require the same. */
export const weightsSchema = z
  .strictObject(termShape)
  .refine((w) => Object.values(w).some((v) => (v as number) > 0), 'At least one weight must be above 0')

const params = z.record(z.string(), z.unknown()).optional()

export const createConfigSchema = z.object({
  weights: weightsSchema,
  params,
  priorMean: z.number().min(0).max(5).optional(),
  priorWeight: z.number().min(0).max(100).optional(),
  note: z.string().trim().max(500).optional(),
})
export const activateSchema = z.object({ note: z.string().trim().min(3).max(500) })
export const shadowSchema = z.object({ enabled: z.boolean(), samplePct: z.number().int().min(1).max(100).default(5) })

export const overrideSchema = z.object({
  scopeType: z.enum(['CATEGORY', 'CITY']),
  scopeValue: z.string().trim().min(2).max(100),
  patch: z.object({
    weights: z.record(z.string(), z.number().min(0).max(1)).optional(),
    params,
  }),
  note: z.string().trim().max(500).optional(),
})

export const simulateSchema = z.object({
  candidate: z.object({
    weights: weightsSchema.optional(),
    params,
    priorMean: z.number().min(0).max(5).optional(),
    priorWeight: z.number().min(0).max(100).optional(),
  }),
  top: z.number().int().min(3).max(20).default(10),
  queries: z
    .array(
      z.object({
        q: z.string().trim().max(100).optional(),
        categoryId: z.string().regex(/^[A-Za-z0-9_-]{1,50}$/).optional(),
        city: z.string().trim().max(100).optional(),
      })
    )
    .min(1)
    .max(20),
})

export const flagSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('add'),
    flagType: z.enum(FLAG_TYPES),
    multiplier: z.number().min(0.2).max(1.25),
    reason: z.string().trim().min(5).max(500),
    expiresAt: z.string().datetime().optional(),
  }),
  z.object({
    action: z.literal('revoke'),
    flagId: z.string().uuid(),
    reason: z.string().trim().min(3).max(500),
  }),
])

export const isVersion = (v: string) => /^\d+$/.test(v) && Number(v) > 0

const num = (v: unknown) => Number(v) || 0
const numOrNull = (v: unknown) => (v === null || v === undefined ? null : Number(v))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapConfig(r: any): RankingConfig {
  return {
    version: Number(r.version),
    weights: r.weights ?? {},
    params: r.params ?? {},
    priorMean: num(r.prior_mean),
    priorWeight: num(r.prior_weight),
    isActive: Boolean(r.is_active),
    shadowEnabled: Boolean(r.shadow_enabled),
    shadowSamplePct: num(r.shadow_sample_pct),
    note: r.note ?? null,
    createdBy: r.created_by ?? null,
    createdAt: r.created_at ?? null,
    activatedBy: r.activated_by ?? null,
    activatedAt: r.activated_at ?? null,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapOverride(r: any): RankingOverride {
  return {
    id: r.id, scopeType: r.scope_type, scopeValue: r.scope_value,
    patch: r.patch ?? {}, note: r.note ?? null, createdAt: r.created_at ?? null,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapPerformance(d: any): WorkerRanking {
  const s = d?.stats
  return {
    worker: {
      id: d.worker.id, name: d.worker.name ?? null, totalBookings: num(d.worker.total_bookings),
      avgRating: num(d.worker.avg_rating), totalReviews: num(d.worker.total_reviews),
    },
    stats: s
      ? {
          acceptedD: num(s.accepted_d), rejectedD: num(s.rejected_d), expiredD: num(s.expired_d),
          completedD: num(s.completed_d), workerCancelD: num(s.worker_cancel_d), noShowD: num(s.no_show_d),
          disputedD: num(s.disputed_d), ratingNd: num(s.rating_n_d), highNd: num(s.high_n_d),
          responseAvgSecs: numOrNull(s.response_avg_secs), completedTotal: num(s.completed_total),
          distinctCustomers: num(s.distinct_customers), repeatRate: num(s.repeat_rate),
          rankingMultiplier: s.ranking_multiplier === null ? 1 : num(s.ranking_multiplier),
          flagTypes: s.flag_types ?? [], halfLifeDays: num(s.half_life_days), computedAt: s.computed_at ?? null,
        }
      : null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    flags: (d.flags ?? []).map((x: any) => ({
      id: x.id, flagType: x.flag_type, multiplier: num(x.multiplier), reason: x.reason, source: x.source,
      createdByEmail: x.created_by_email ?? null, createdAt: x.created_at, expiresAt: x.expires_at ?? null,
      revokedAt: x.revoked_at ?? null,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    daily: (d.daily ?? []).map((x: any) => ({
      day: x.day, offered: num(x.offered), accepted: num(x.accepted), rejected: num(x.rejected), expired: num(x.expired),
      completed: num(x.completed), cancelledByWorker: num(x.cancelled_by_worker),
      cancelledByCustomer: num(x.cancelled_by_customer), noShow: num(x.no_show), disputed: num(x.disputed),
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    topCustomers: (d.top_customers ?? []).map((x: any) => ({
      completedCount: num(x.completed_count), lastCompletedAt: x.last_completed_at, share: num(x.share),
    })),
  }
}

// ---------- explain ----------
const emptyToUndef = (v: unknown) => (v === '' ? undefined : v)
const optNum = <T extends z.ZodType>(s: T) => z.preprocess(emptyToUndef, s.optional())

export const explainQuerySchema = z
  .object({
    q: z.preprocess(emptyToUndef, z.string().trim().min(1).max(100).optional()),
    categoryId: z.preprocess(emptyToUndef, z.string().trim().regex(/^[A-Za-z0-9_-]{1,50}$/).optional()),
    city: z.preprocess(emptyToUndef, z.string().trim().min(1).max(100).optional()),
    lat: optNum(z.coerce.number().finite().min(-90).max(90)),
    lng: optNum(z.coerce.number().finite().min(-180).max(180)),
    radius: optNum(z.coerce.number().finite().positive().max(50000)),
  })
  .superRefine((d, ctx) => {
    const n = [d.lat, d.lng, d.radius].filter((v) => v !== undefined).length
    if (n > 0 && n < 3) ctx.addIssue({ code: 'custom', message: 'lat, lng and radius must all be provided together' })
  })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapExplain(d: any): RankingExplain {
  const w = d?.worker ?? {}
  const c = d?.context ?? {}
  const b = d?.boost ?? {}
  const p = d?.performance ?? {}
  const m = d?.multipliers ?? {}
  const rk = d?.rank
  return {
    worker: {
      id: w.worker_id, name: w.name ?? null, businessName: w.business_name ?? null, city: w.city ?? null,
      providerType: w.provider_type ?? 'INDIVIDUAL', avgRating: num(w.avg_rating), totalReviews: num(w.total_reviews),
      totalBookings: num(w.total_bookings), isFeatured: Boolean(w.is_featured), badges: w.badges ?? [],
      isOnJob: Boolean(w.is_on_job), responseTimeMins: num(w.response_time_mins), lastSeenAt: w.last_seen_at ?? null,
      indexedAt: w.indexed_at ?? null,
    },
    context: {
      q: c.q ?? null, categoryId: c.category_id ?? null, city: c.city ?? null, hasLocation: Boolean(c.has_location),
      radius: numOrNull(c.radius), rankingVersion: num(c.ranking_version), overridesApplied: Boolean(c.overrides_applied),
      fallbackConfig: Boolean(c.fallback_config),
    },
    eligibility: { visible: Boolean(d?.eligibility?.visible), matchesFilters: Boolean(d?.eligibility?.matches_filters) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    terms: (d?.terms ?? []).map((t: any) => ({
      term: t.term, applies: Boolean(t.applies), notAppliedReason: t.not_applied_reason ?? null,
      value: numOrNull(t.value), weight: num(t.weight), weightShare: num(t.weight_share), points: num(t.points),
    })),
    weighted: { points: num(d?.weighted?.points), fallbackUsed: Boolean(d?.weighted?.fallback_used) },
    multipliers: {
      quality: m.quality === undefined ? 1 : num(m.quality), reliability: m.reliability === undefined ? 1 : num(m.reliability),
      flag: m.flag === undefined ? 1 : num(m.flag), product: m.product === undefined ? 1 : num(m.product),
    },
    afterFloors: num(d?.after_floors),
    boost: {
      featured: num(b.featured), topRated: num(b.top_rated), backgroundVerified: num(b.background_verified),
      promotion: { points: num(b.promotion?.points), bestPct: num(b.promotion?.best_pct), until: b.promotion?.until ?? null },
      rawTotal: num(b.raw_total), cap: num(b.cap), cappedTotal: num(b.capped_total),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      gates: (b.gates ?? []).map((g: any) => ({ key: g.key, value: numOrNull(g.value), min: num(g.min), pass: Boolean(g.pass) })),
      gatePass: Boolean(b.gate_pass), applied: num(b.applied),
    },
    finalScore: num(d?.final_score),
    checkDelta: num(d?.check_delta),
    rank: rk
      ? {
          scoreOrder: numOrNull(rk.score_order), afterDiversity: numOrNull(rk.after_diversity),
          scanned: num(rk.scanned), totalMatching: num(rk.total_matching), moved: Boolean(rk.moved),
        }
      : null,
    performance: {
      hasData: Boolean(p.has_data), updatedAt: p.updated_at ?? null,
      acceptedD: num(p.accepted_d), rejectedD: num(p.rejected_d), expiredD: num(p.expired_d), completedD: num(p.completed_d),
      workerCancelD: num(p.worker_cancel_d), noShowD: num(p.no_show_d), ratingNd: num(p.rating_n_d), highNd: num(p.high_n_d),
      acceptanceRate: numOrNull(p.acceptance_rate), completionRate: numOrNull(p.completion_rate),
      cancelNoShowRate: numOrNull(p.cancel_no_show_rate), highRatingShare: numOrNull(p.high_rating_share),
      jobsDone: num(p.jobs_done), repeatRate: num(p.repeat_rate),
      rankingMultiplier: p.ranking_multiplier === undefined ? 1 : num(p.ranking_multiplier),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reasonCodes: (d?.reason_codes ?? []).map((r: any) => ({ code: r.code, severity: r.severity, detail: r.detail ?? null })),
  }
}
