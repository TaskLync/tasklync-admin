// types/dispute.ts
import type { DisputeResolution, DisputeStatus, DisputeTab } from '@/lib/dispute-constants'
import type { RefundFilters } from '@/types/payment'

// ---------- List ----------

export interface DisputeListItem {
  id: string
  bookingId: string
  status: DisputeStatus
  resolution: DisputeResolution | null
  reason: string
  openedByAdmin: boolean
  isEscalated: boolean
  hasWorkerResponse: boolean
  evidenceCount: number
  refundAmount: number | null
  /** Amount at stake = the booking's quoted total. */
  amount: number
  currency: string
  categoryId: string
  categoryName: string | null
  city: string | null
  userId: string | null
  userName: string | null
  userPhone: string | null
  workerId: string | null
  workerName: string | null
  workerPhone: string | null
  assignedToId: string | null
  assignedToName: string | null
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
}

export interface DisputeListResponse {
  data: DisputeListItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface DisputeFilters {
  tab: DisputeTab
  search: string
  city: string
  categoryId: string
  assigned: 'all' | 'me' | 'unassigned'
  resolution: 'all' | DisputeResolution
  amountMin: string
  amountMax: string
  dateFrom: string | null
  dateTo: string | null
  page: number
  pageSize: number
}

export interface DisputeCounts {
  open: number
  awaiting: number
  escalated: number
  resolved: number
  overdue48h: number
  overdue72h: number
  refundedAmount30d: number
}

// ---------- Detail ----------

export interface DisputeParty {
  id: string | null
  name: string | null
  phone: string | null
  avatarUrl: string | null
}

export interface DisputeRefundRecord {
  id: string
  amount: number
  percentage: number
  reason: string
  status: string
  method: string
  gatewayReference: string | null
  failureReason: string | null
  initiatedAt: string
  completedAt: string | null
}

export interface DisputeActivityRow {
  id: string
  adminEmail: string | null
  action: string
  notes: string | null
  createdAt: string
}

export interface DisputeDetail {
  id: string
  bookingId: string
  status: DisputeStatus
  resolution: DisputeResolution | null
  reason: string
  openedByAdmin: boolean
  evidenceUrls: string[]
  workerResponse: string | null
  adminNote: string | null
  refundAmount: number | null
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  resolvedByName: string | null
  /** created_at + 24h. After this the dispute no longer waits for the worker. */
  responseDueAt: string

  isEscalated: boolean
  escalatedAt: string | null
  escalatedByName: string | null
  escalationNote: string | null

  assignedTo: { id: string; name: string | null; email: string | null } | null
  assignedAt: string | null
  assignedToMe: boolean

  booking: {
    id: string
    status: string
    categoryId: string
    categoryName: string | null
    city: string | null
    scheduledAt: string
    startedAt: string | null
    completedAt: string | null
    estimatedTotal: number
    platformFee: number
    workerAmount: number
    currency: string
    isPaymentConfirmed: boolean
    paymentIntentId: string | null
  }
  user: DisputeParty
  worker: DisputeParty & { avgRating: number; totalReviews: number }

  refundsAvailable: boolean
  refunds: DisputeRefundRecord[]
  activity: DisputeActivityRow[]
}

export interface DisputeNote {
  id: string
  adminEmail: string
  note: string
  createdAt: string
}

// ---------- Refunds view ----------

/** 'dispute' = only refunds on bookings that have a dispute. 'everything' = all refunds. */
export type DisputeRefundFilters = RefundFilters & { source: 'dispute' | 'everything' }