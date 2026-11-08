// lib/promotions-api.ts (server only)
import { z } from 'zod'
import { PROMOTION_SETTING_FIELDS, type PromotionState } from '@/lib/promotion-constants'
import type { PromotionItem, PromotionSettings } from '@/types/promotion'

// action -> permission. booking-service enforces the real state machine.
export const ACTIONS = {
  approve: 'promotions:approve',
  reject: 'promotions:approve',
  pause: 'promotions:suspend',
  resume: 'promotions:suspend',
  end: 'promotions:suspend',
} as const
export type PromotionAction = keyof typeof ACTIONS
export const isAction = (a: string): a is PromotionAction => a in ACTIONS

export const REASON_REQUIRED: PromotionAction[] = ['reject', 'pause', 'end']
export const PAST: Record<PromotionAction, string> = {
  approve: 'approved', reject: 'rejected', pause: 'paused', resume: 'resumed', end: 'ended',
}

// ---- guardrail settings (same ranges as booking-service adminPromoSettingsSchema) ----
const shape: Record<string, z.ZodNumber> = {}
for (const f of PROMOTION_SETTING_FIELDS) {
  const base = z.number()
  shape[f.key] = (f.int ? base.int() : base).min(f.min).max(f.max)
}
export const promotionSettingsSchema = z.object(shape).refine(
  (v) => (v as Record<string, number>).autoApproveMaxPct <= (v as Record<string, number>).maxDiscountPct,
  { path: ['autoApproveMaxPct'], message: 'Cannot exceed the max percent discount' }
)

export function toServiceSettings(b: Record<string, number>) {
  return Object.fromEntries(PROMOTION_SETTING_FIELDS.map((f) => [f.api, b[f.key]]))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapSettings(r: any): PromotionSettings {
  const raw = r?.settings ?? r ?? {}
  return Object.fromEntries(PROMOTION_SETTING_FIELDS.map((f) => [f.key, Number(raw[f.api])])) as PromotionSettings
}

// ---- rows ----
const n = (v: unknown) => (v === null || v === undefined ? null : Number(v))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function stateOf(r: any, now = Date.now()): PromotionState {
  if (r.status === 'PENDING_APPROVAL') return 'pending'
  if (r.status === 'REJECTED') return 'rejected'
  if (r.status === 'ENDED') return 'ended'
  if (r.status === 'EXHAUSTED') return 'exhausted'
  if (r.status === 'EXPIRED' || new Date(r.ends_at).getTime() <= now) return 'expired'
  if (r.status === 'PAUSED') return r.paused_by === 'ADMIN' ? 'paused_admin' : 'paused'
  return new Date(r.starts_at).getTime() > now ? 'scheduled' : 'active'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapPromotion(r: any): PromotionItem {
  return {
    id: r.id,
    workerId: r.worker_id,
    workerName: r.worker_name ?? null,
    title: r.title,
    description: r.description ?? null,
    discountType: r.discount_type,
    discountValue: Number(r.discount_value),
    maxDiscountAmount: n(r.max_discount_amount),
    minBookingAmount: Number(r.min_booking_amount ?? 0),
    offeringId: r.offering_id ?? null,
    categoryId: r.category_id ?? null,
    referencePrice: Number(r.reference_price ?? 0),
    firstBookingOnly: Boolean(r.first_booking_only),
    code: r.code_display ?? null,
    status: r.status,
    state: stateOf(r),
    approvalMode: r.approval_mode,
    pausedBy: r.paused_by ?? null,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    maxRedemptions: n(r.max_redemptions),
    redemptionCount: Number(r.redemption_count ?? 0),
    perUserLimit: Number(r.per_user_limit ?? 1),
    rejectionReason: r.rejection_reason ?? null,
    createdAt: r.created_at,
  }
}