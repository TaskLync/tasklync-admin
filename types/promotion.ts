import type { PromotionSettingKey, PromotionState } from '@/lib/promotion-constants'

export interface PromotionItem {
  id: string
  workerId: string
  workerName: string | null
  title: string
  description: string | null
  discountType: 'PERCENT' | 'FIXED'
  discountValue: number
  maxDiscountAmount: number | null
  minBookingAmount: number
  offeringId: string | null
  categoryId: string | null
  referencePrice: number
  firstBookingOnly: boolean
  code: string | null
  status: string
  state: PromotionState
  approvalMode: 'AUTO' | 'ADMIN'
  pausedBy: 'WORKER' | 'ADMIN' | null
  startsAt: string
  endsAt: string
  maxRedemptions: number | null
  redemptionCount: number
  perUserLimit: number
  rejectionReason: string | null
  createdAt: string
}

export interface PromotionDetail extends PromotionItem {
  stats: { consumed: number; released: number; discountPkr: number; workerCostPkr: number }
  history: { fromStatus: string | null; toStatus: string; actorType: string; actorEmail: string | null; note: string | null; createdAt: string }[]
  abuseSignals: { id: string; signal: string; severity: number; detail: Record<string, unknown> | null; createdAt: string }[]
}

export interface PromotionList { data: PromotionItem[]; page: number; pageSize: number; total: number; totalPages: number }
export interface PromotionFilters { search: string; status: string; page: number; pageSize: number }
export type PromotionSettings = Record<PromotionSettingKey, number>