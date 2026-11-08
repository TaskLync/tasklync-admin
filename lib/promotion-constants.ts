// lib/promotion-constants.ts  (edge safe, shared by server and client)
export const PROMOTION_STATUS_FILTERS = [
  'all', 'PENDING_APPROVAL', 'ACTIVE', 'PAUSED', 'EXHAUSTED', 'EXPIRED', 'ENDED', 'REJECTED',
] as const
export type PromotionStatusFilter = (typeof PROMOTION_STATUS_FILTERS)[number]

export type PromotionState =
  | 'pending' | 'rejected' | 'scheduled' | 'active' | 'paused' | 'paused_admin' | 'exhausted' | 'expired' | 'ended'

export const PROMOTION_STATE_LABEL: Record<PromotionState, string> = {
  pending: 'Needs approval', rejected: 'Rejected', scheduled: 'Scheduled', active: 'Active',
  paused: 'Paused by worker', paused_admin: 'Paused by admin', exhausted: 'Used up', expired: 'Expired', ended: 'Ended',
}

export type PromotionSettingKey =
  | 'maxDiscountPct' | 'maxFixedDiscountPkr' | 'minPayableSubtotalPkr' | 'autoApproveMaxPct'
  | 'autoApproveMaxFixedPkr' | 'autoApproveMaxCodeUses' | 'maxActivePerWorker' | 'maxDurationDays'
  | 'maxRedemptionsCap' | 'priceInflationTolerancePct'

export interface PromotionSettingField {
  key: PromotionSettingKey
  api: string // snake_case name used by booking-service
  label: string
  hint: string
  min: number // same ranges as adminPromoSettingsSchema in booking-service (01 §10)
  max: number
  step: number
  int?: boolean
}

export const PROMOTION_SETTING_FIELDS: PromotionSettingField[] = [
  { key: 'maxDiscountPct', api: 'max_discount_pct', label: 'Max percent discount (%)', hint: 'Hard cap for any worker offer, also applied at checkout.', min: 1, max: 50, step: 1 },
  { key: 'maxFixedDiscountPkr', api: 'max_fixed_discount_pkr', label: 'Max fixed discount (PKR)', hint: 'Hard cap for fixed-amount offers.', min: 50, max: 5000, step: 50 },
  { key: 'minPayableSubtotalPkr', api: 'min_payable_subtotal_pkr', label: 'Minimum payable subtotal (PKR)', hint: 'A discount can never take the job below this.', min: 100, max: 2000, step: 50 },
  { key: 'autoApproveMaxPct', api: 'auto_approve_max_pct', label: 'Auto-approve up to (%)', hint: 'Percent offers up to this value go live without review. Cannot exceed the max percent.', min: 0, max: 30, step: 1 },
  { key: 'autoApproveMaxFixedPkr', api: 'auto_approve_max_fixed_pkr', label: 'Auto-approve fixed up to (PKR)', hint: 'Fixed offers up to this amount go live without review.', min: 0, max: 2000, step: 50 },
  { key: 'autoApproveMaxCodeUses', api: 'auto_approve_max_code_uses', label: 'Auto-approve code offers up to (uses)', hint: 'Offers with a share code above this many uses need review.', min: 1, max: 1000, step: 10, int: true },
  { key: 'maxActivePerWorker', api: 'max_active_per_worker', label: 'Active offers per worker', hint: 'Active + pending + paused. Lower it to 1 for the first rollout.', min: 1, max: 10, step: 1, int: true },
  { key: 'maxDurationDays', api: 'max_duration_days', label: 'Max offer duration (days)', hint: 'Longest allowed window.', min: 1, max: 90, step: 1, int: true },
  { key: 'maxRedemptionsCap', api: 'max_redemptions_cap', label: 'Max total uses per offer', hint: 'Upper limit a worker can set.', min: 1, max: 5000, step: 50, int: true },
  { key: 'priceInflationTolerancePct', api: 'price_inflation_tolerance_pct', label: 'Price rise tolerance (%)', hint: 'If the worker raises the price more than this after creating the offer, it stops applying.', min: 0, max: 20, step: 1 },
]