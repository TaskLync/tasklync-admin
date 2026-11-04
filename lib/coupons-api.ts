// lib/coupons-api.ts (server only)
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { MAX_FIXED_PKR, MAX_PERCENT, type CouponState } from '@/lib/coupon-constants'
import type { CouponItem } from '@/types/coupon'

const core = {
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(500).optional(),
  discountType: z.enum(['PERCENT', 'FIXED']),
  discountValue: z.number().positive(),
  maxDiscountAmount: z.number().positive().optional(),
  minBookingAmount: z.number().min(0).default(0),
  scopeCategoryIds: z.array(z.string().regex(/^[a-z0-9-]{1,50}$/i)).max(50).optional(),
  firstBookingOnly: z.boolean().default(false),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  perUserLimit: z.number().int().min(1).max(10).default(1),
}

const rules = (v: { discountType: string; discountValue: number; startsAt: string; endsAt: string }, ctx: z.RefinementCtx) => {
  if (v.discountType === 'PERCENT' && v.discountValue > MAX_PERCENT)
    ctx.addIssue({ code: 'custom', path: ['discountValue'], message: `Percent coupons are capped at ${MAX_PERCENT}%` })
  if (v.discountType === 'FIXED' && v.discountValue > MAX_FIXED_PKR)
    ctx.addIssue({ code: 'custom', path: ['discountValue'], message: `Fixed coupons are capped at PKR ${MAX_FIXED_PKR}` })
  if (new Date(v.endsAt) <= new Date(v.startsAt))
    ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'The end must be after the start' })
  if (new Date(v.endsAt) <= new Date())
    ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'The end must be in the future' })
}

export const couponCreateSchema = z
  .object({
    ...core,
    code: z.string().trim().min(4).max(16).regex(/^[A-Za-z0-9-]+$/, 'Letters, digits and dashes only'),
    assignedUserId: z.string().uuid().optional(),
    maxRedemptions: z.number().int().positive().optional(),
    budgetCapPkr: z.number().positive().optional(),
  })
  .superRefine(rules)

export const couponBatchSchema = z
  .object({
    ...core,
    prefix: z.string().trim().regex(/^[A-Za-z0-9]{0,6}$/).default(''),
    count: z.number().int().min(1).max(5000),
    maxDiscountAmount: z.number().positive(),
  })
  .superRefine(rules)

export const ACTIONS = {
  pause: 'coupons:manage',
  resume: 'coupons:manage',
  end: 'coupons:manage',
  extend: 'coupons:manage',
  approve: 'coupons:approve-high',
  reject: 'coupons:approve-high',
} as const
export type CouponAction = keyof typeof ACTIONS
export const isAction = (a: string): a is CouponAction => a in ACTIONS

export function toServiceBody(b: Record<string, any>) {
  return {
    code: b.code, prefix: b.prefix, count: b.count, title: b.title, description: b.description,
    discount_type: b.discountType, discount_value: b.discountValue, max_discount_amount: b.maxDiscountAmount,
    min_booking_amount: b.minBookingAmount, scope_category_ids: b.scopeCategoryIds,
    first_booking_only: b.firstBookingOnly, assigned_user_id: b.assignedUserId,
    starts_at: b.startsAt, ends_at: b.endsAt, max_redemptions: b.maxRedemptions,
    per_user_limit: b.perUserLimit, budget_cap_pkr: b.budgetCapPkr,
  }
}

export function stateOf(r: any, now = Date.now()): CouponState {
  if (r.status === 'PENDING_APPROVAL') return 'pending'
  if (r.status === 'REJECTED') return 'rejected'
  if (r.status === 'ENDED') return 'ended'
  if (r.status === 'EXHAUSTED') return 'exhausted'
  if (new Date(r.ends_at).getTime() <= now) return 'expired'
  if (r.status === 'PAUSED') return 'paused'
  return new Date(r.starts_at).getTime() > now ? 'scheduled' : 'active'
}

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v))

export function mapCoupon(r: any): CouponItem {
  return {
    id: r.id, code: r.code_display, title: r.title, description: r.description,
    discountType: r.discount_type, discountValue: Number(r.discount_value),
    maxDiscountAmount: n(r.max_discount_amount), minBookingAmount: Number(r.min_booking_amount),
    scopeCategoryIds: r.scope_category_ids ?? [], firstBookingOnly: r.first_booking_only,
    assignedUserId: r.assigned_user_id, status: r.status, state: stateOf(r),
    startsAt: r.starts_at, endsAt: r.ends_at, maxRedemptions: n(r.max_redemptions),
    redemptionCount: Number(r.redemption_count), perUserLimit: Number(r.per_user_limit),
    budgetCapPkr: n(r.budget_cap_pkr), budgetSpentPkr: Number(r.budget_spent_pkr),
    batchId: r.batch_id, createdByEmail: r.created_by_email, rejectionReason: r.rejection_reason,
    createdAt: r.created_at,
  }
}

export function zodResponse(err: unknown) {
  if (err instanceof z.ZodError) {
    const i = err.issues[0]
    return NextResponse.json({ error: `${i.path.join('.') || 'Input'}: ${i.message}` }, { status: 400 })
  }
  return null
}