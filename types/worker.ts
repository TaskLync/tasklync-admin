// types/worker.ts
import type { AvailabilityAwareList } from '@/types/user'

export type { AvailabilityAwareList }

export type WorkerStatus = 'active' | 'inactive' | 'suspended' | 'banned' | 'deleted'
export type WorkerPresence = 'online' | 'away' | 'offline' | 'paused' | 'on_job'
export type WorkerVerificationStatus =
  | 'unverified'
  | 'pending_review'
  | 'verified'
  | 'rejected'
  | 'suspended'
export type WorkerBadgeKey = 'top_rated' | 'background_verified'

export interface CategoryOption {
  id: string
  name: string
}

// ---- List ----

export interface WorkerListItem {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  avatarUrl: string | null
  city: string | null
  categories: string | null
  avgRating: number
  totalReviews: number
  totalBookings: number
  isActive: boolean
  isFeatured: boolean
  verificationStatus: WorkerVerificationStatus
  status: WorkerStatus
  presence: WorkerPresence
  createdAt: string
}

export interface WorkerListResponse {
  data: WorkerListItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface WorkerFilters {
  search: string
  city: string | 'all'
  categoryId: string | 'all'
  verification: WorkerVerificationStatus | 'all'
  status: WorkerStatus | 'all'
  presence: WorkerPresence | 'all'
  ratingBucket: 'lt3' | '3-4' | '4+' | 'unrated' | 'all'
  dateFrom: string | null
  dateTo: string | null
  sortBy: 'created_at' | 'name' | 'total_bookings' | 'avg_rating'
  sortDir: 'asc' | 'desc'
  page: number
  pageSize: number
}

export interface WorkerKpis {
  totalWorkers: number
  signupsToday: number
  signupsTodayChangePct: number | null
  onlineNow: number
  suspendedOrBanned: number
  signupsSparkline7d: number[]
}

// ---- Detail ----

export interface WorkerDetail {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  avatarUrl: string | null
  bio: string | null
  city: string | null
  country: string | null
  preferredLanguage: string
  currency: string
  yearsExperience: number
  avgRating: number
  totalReviews: number
  totalBookings: number
  responseTimeMins: number
  isActive: boolean
  isFeatured: boolean
  featuredAt: string | null
  manuallyPaused: boolean
  isOnJob: boolean
  lastSeenAt: string | null
  verificationStatus: WorkerVerificationStatus
  status: WorkerStatus
  presence: WorkerPresence
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  suspendedUntil: string | null
  suspendedReason: string | null
  bannedAt: string | null
  bannedReason: string | null
  warningCount: number
  lastWarningAt: string | null
  lastWarningReason: string | null
  reverificationRequestedAt: string | null
  reverificationReason: string | null
  skillCount: number
  offeringCount: number
  documentCount: number
  pendingDocumentCount: number
  skills: string[]
  badges: WorkerBadgeKey[]
}

export interface WorkerPerformance {
  /** false when the bookings table / columns don't exist yet */
  available: boolean
  completedJobs: number | null
  receivedJobs: number | null
  /** 0–100, null when there is nothing to compute from */
  acceptanceRate: number | null
  cancellationRate: number | null
  avgRating: number
  totalReviews: number
  responseTimeMins: number
  /** null when the reviews table doesn't exist yet */
  ratingBreakdown: Record<'1' | '2' | '3' | '4' | '5', number> | null
}

export interface WorkerJobRow {
  id: string
  customerName: string | null
  category: string | null
  status: string
  amount: number | null
  scheduledAt: string | null
  createdAt: string
}

export interface WorkerReviewRow {
  id: string
  customerName: string | null
  rating: number
  comment: string | null
  isFlagged: boolean
  createdAt: string
}

export interface WorkerEarnings {
  available: boolean
  currency: string
  lifetime: number
  thisMonth: number
  lastMonth: number
}

export interface WorkerRecurringSlot {
  dayOfWeek: number // 0 = Sunday … 6 = Saturday
  startTime: string // "09:00"
  endTime: string // "18:00"
}

export interface WorkerBlockedDate {
  id: string
  blockedDate: string // "YYYY-MM-DD"
  startTime: string | null // null = full day
  endTime: string | null
  reason: string | null
}

export interface WorkerAvailabilityData {
  recurring: WorkerRecurringSlot[]
  blocked: WorkerBlockedDate[]
}

export interface WorkerSkillRow {
  id: string
  categoryId: string
  categoryName: string | null
  yearsExp: number
  isVerified: boolean
}

export interface WorkerOfferingRow {
  id: string
  name: string | null
  isCustom: boolean
  customPrice: number
  priceType: 'fixed' | 'hourly' | 'quote' | string
  isActive: boolean
}

export interface WorkerCatalog {
  skills: WorkerSkillRow[]
  offerings: WorkerOfferingRow[]
}

export interface WorkerDocumentRow {
  id: string
  type: 'NATIONAL_ID' | 'PASSPORT' | 'SKILL_CERTIFICATE' | 'POLICE_CLEARANCE' | string
  fileUrl: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | string
  rejectionNote: string | null
  reviewedAt: string | null
  createdAt: string
}