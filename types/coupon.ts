import type { CouponState } from '@/lib/coupon-constants'

export interface CouponItem {
  id: string
  code: string
  title: string
  description: string | null
  discountType: 'PERCENT' | 'FIXED'
  discountValue: number
  maxDiscountAmount: number | null
  minBookingAmount: number
  scopeCategoryIds: string[]
  firstBookingOnly: boolean
  assignedUserId: string | null
  status: string
  state: CouponState
  startsAt: string
  endsAt: string
  maxRedemptions: number | null
  redemptionCount: number
  perUserLimit: number
  budgetCapPkr: number | null
  budgetSpentPkr: number
  batchId: string | null
  createdByEmail: string
  rejectionReason: string | null
  createdAt: string
}

export interface CouponDetail extends CouponItem {
  stats: { consumed: number; released: number; discountPkr: number }
  history: { fromStatus: string | null; toStatus: string; actorEmail: string | null; note: string | null; createdAt: string }[]
}

export interface CouponRedemptionRow {
  id: string; bookingId: string; status: 'CONSUMED' | 'RELEASED'; discountAmount: number
  subtotalBefore: number; releaseReason: string | null; createdAt: string; releasedAt: string | null
  userName: string | null; phoneLast4: string
}

export interface CouponFilters { search: string; status: string; page: number; pageSize: number }
export interface CouponList { data: CouponItem[]; page: number; pageSize: number; total: number; totalPages: number }