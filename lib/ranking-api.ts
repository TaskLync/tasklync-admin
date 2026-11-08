// lib/ranking-api.ts (server only)
import { z } from 'zod'
import { FLAG_TYPES, RANKING_TERMS } from '@/lib/ranking-constants'
import type { RankingConfig, RankingOverride, WorkerRanking } from '@/types/ranking'

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