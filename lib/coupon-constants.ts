export const COUPON_STATUS_FILTERS = ['all', 'ACTIVE', 'PAUSED', 'PENDING_APPROVAL', 'EXHAUSTED', 'ENDED', 'REJECTED', 'expired'] as const
export type CouponStatusFilter = (typeof COUPON_STATUS_FILTERS)[number]

export const MAX_PERCENT = 50
export const MAX_FIXED_PKR = 5000
/** Display only. booking-service decides (COUPON_HIGH_BUDGET_THRESHOLD_PKR). */
export const HIGH_BUDGET_HINT_PKR = 100_000

export type CouponState = 'pending' | 'rejected' | 'scheduled' | 'active' | 'paused' | 'exhausted' | 'expired' | 'ended'

export const STATE_LABEL: Record<CouponState, string> = {
  pending: 'Needs approval', rejected: 'Rejected', scheduled: 'Scheduled', active: 'Active',
  paused: 'Paused', exhausted: 'Used up', expired: 'Expired', ended: 'Ended',
}