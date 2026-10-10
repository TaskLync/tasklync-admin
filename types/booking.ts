// types/booking.ts
import type { BoardColumn, BookingStatus, PaymentStatus } from '@/lib/booking-constants'

export type { BoardColumn, BookingStatus, PaymentStatus }

// ---- List ----

export interface BookingListItem {
  id: string
  status: BookingStatus
  categoryId: string
  categoryName: string | null
  city: string | null
  userId: string | null
  userName: string | null
  userPhone: string | null
  workerId: string | null
  workerName: string | null
  workerPhone: string | null
  amount: number
  currency: string
  isUrgent: boolean
  durationHours: number
  scheduledAt: string
  createdAt: string
  /** Proxy for "time in current status" */
  updatedAt: string
  startedAt: string | null
  paymentStatus: PaymentStatus
  hasDispute: boolean
}

export interface BookingListResponse {
  data: BookingListItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface BookingFilters {
  search: string
  status: BookingStatus | 'all'
  city: string | 'all'
  categoryId: string | 'all'
  paymentStatus: PaymentStatus | 'all'
  hasDispute: 'yes' | 'no' | 'all'
  amountMin: string
  amountMax: string
  dateFrom: string | null
  dateTo: string | null
  sortBy: 'created_at' | 'scheduled_at' | 'amount' | 'updated_at'
  sortDir: 'asc' | 'desc'
  page: number
  pageSize: number
}

export interface BookingKpis {
  bookingsToday: number
  bookingsTodayChangePct: number | null
  pendingNow: number
  inProgressNow: number
  disputedNow: number
  createdSparkline7d: number[]
}

export interface BookingBoardColumnData {
  total: number
  items: BookingListItem[]
}

export interface BookingBoard {
  columns: Record<BoardColumn, BookingBoardColumnData>
}

// ---- Detail ----

export interface BookingUserParty {
  id: string | null
  name: string | null
  phone: string | null
  email: string | null
  avatarUrl: string | null
  status: string | null
  totalBookings: number
}

export interface BookingWorkerParty {
  id: string | null
  name: string | null
  phone: string | null
  avatarUrl: string | null
  avgRating: number
  totalReviews: number
  city: string | null
  verificationStatus: string | null
  status: string | null
  presence: string | null
}

export interface BookingDisputeSummary {
  id: string
  status: string
  resolution: string | null
  reason: string
  refundAmount: number | null
  createdAt: string
}

export interface BookingPricing {
  basePrice: number
  priceType: 'fixed' | 'hourly' | string
  urgencyMultiplier: number
  demandMultiplier: number
  timeOfDayMultiplier: number
  estimatedTotal: number
  platformFee: number
  workerAmount: number
  currency: string
  refundAmount: number | null
  refundPercentage: number | null
}

export interface BookingDetail {
  id: string
  status: BookingStatus
  categoryId: string
  categoryName: string | null
  serviceId: string | null
  serviceName: string | null
  serviceType: string
  scheduledAt: string
  durationHours: number
  expiresAt: string
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  city: string | null
  addressText: string
  lat: number | null
  lng: number | null
  pricing: BookingPricing
  isUrgent: boolean
  isPaymentConfirmed: boolean
  paymentIntentId: string | null
  autoCompleted: boolean
  paymentStatus: PaymentStatus
  description: string | null
  workerNote: string | null
  cancellationReason: string | null
  cancelledBy: string | null
  user: BookingUserParty
  worker: BookingWorkerParty
  dispute: BookingDisputeSummary | null
}

export interface BookingStatusHistoryRow {
  id: number
  fromStatus: BookingStatus | null
  toStatus: BookingStatus
  actor: string | null
  isBackfilled: boolean
  changedAt: string
}

export interface BookingTimeline {
  available: boolean
  data: BookingStatusHistoryRow[]
}

export interface BookingChatMessage {
  id: string
  senderId: string | null
  senderType: 'user' | 'worker' | 'system'
  type: 'text' | 'image' | 'location' | 'system'
  content: string | null
  mediaUrl: string | null
  mediaThumbnailUrl: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface BookingChatData {
  available: boolean
  data: BookingChatMessage[]
}

export interface BookingPaymentRow {
  id: string
  status: string
  amount: number | null
  workerAmount: number | null
  platformFee: number | null
  providerRef: string | null
  createdAt: string
}

export interface BookingPaymentData {
  /** false when the payments table is not reachable */
  available: boolean
  estimatedTotal: number
  platformFee: number
  workerAmount: number
  currency: string
  isPaymentConfirmed: boolean
  paymentIntentId: string | null
  refundAmount: number | null
  refundPercentage: number | null
  payments: BookingPaymentRow[]
}

export interface TrailPoint {
  lat: number
  lng: number
  recordedAt: string
}

export interface BookingLocationData {
  jobSite: { lat: number; lng: number } | null
  /** false when the GPS history table is not reachable */
  trailAvailable: boolean
  trail: TrailPoint[]
}

export interface BookingNote {
  id: string
  adminEmail: string
  note: string
  createdAt: string
}

export interface ReassignCandidate {
  id: string
  name: string | null
  phone: string | null
  city: string | null
  avgRating: number
  totalReviews: number
  presence: string
}