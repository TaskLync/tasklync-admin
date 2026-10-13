// types/review.ts
import type {
  AuditFlag,
  ModerationStatus,
  ReportReason,
  ReviewListTab,
  ReviewSignal,
} from '@/lib/review-constants'

// ---------- List ----------

export interface ReviewListItem {
  id: string
  bookingId: string
  rating: number
  comment: string | null
  tags: string[]
  photoCount: number
  hasWorkerReply: boolean
  moderationStatus: ModerationStatus
  reportCount: number
  openReportCount: number
  latestReportReason: ReportReason | null
  signals: ReviewSignal[]
  categoryId: string | null
  categoryName: string | null
  city: string | null
  userId: string | null
  userName: string | null
  userPhone: string | null
  workerId: string | null
  workerName: string | null
  workerPhone: string | null
  editedAt: string | null
  createdAt: string
}

export interface ReviewListResponse {
  data: ReviewListItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface ReviewFilters {
  tab: ReviewListTab
  search: string
  rating: string // 'all' | '1'..'5'
  city: string
  categoryId: string
  status: 'all' | ModerationStatus
  signal: 'all' | ReviewSignal
  workerId: string
  userId: string
  dateFrom: string | null
  dateTo: string | null
  page: number
  pageSize: number
}

export interface ReviewCounts {
  flagged: number
  autoHidden: number
  adminHidden: number
  total: number
  last30d: number
  avgRating30d: number | null
  sparkline7d: number[]
}

// ---------- Detail ----------

export interface ReviewReviewer {
  id: string | null
  name: string | null
  phone: string | null
  avatarUrl: string | null
  warningCount: number
  reviewsWritten: number
  avgGiven: number | null
  oneStar30d: number
}

export interface ReviewWorker {
  id: string | null
  name: string | null
  phone: string | null
  avatarUrl: string | null
  city: string | null
  avgRating: number
  totalReviews: number
}

export interface ReviewReportRow {
  id: string
  reporterId: string
  reporterRole: 'user' | 'worker'
  reporterName: string | null
  reason: ReportReason
  note: string | null
  createdAt: string
  resolvedAt: string | null
  resolvedByName: string | null
}

export interface ReviewActivityRow {
  id: string
  adminEmail: string | null
  action: string
  notes: string | null
  createdAt: string
}

export interface ReviewDetail {
  id: string
  bookingId: string
  rating: number
  comment: string | null
  tags: string[]
  photoUrls: string[]
  workerReply: string | null
  workerRepliedAt: string | null
  moderationStatus: ModerationStatus
  reportCount: number
  openReportCount: number
  signals: ReviewSignal[]
  editedAt: string | null
  createdAt: string
  updatedAt: string
  moderatedAt: string | null
  moderatedByName: string | null
  moderationNote: string | null

  booking: {
    id: string
    status: string | null
    categoryId: string | null
    categoryName: string | null
    scheduledAt: string | null
    completedAt: string | null
    estimatedTotal: number | null
    currency: string
    reviewDeadline: string | null
  }
  reviewer: ReviewReviewer
  worker: ReviewWorker
  reports: ReviewReportRow[]
  activity: ReviewActivityRow[]
}

export interface ReviewNote {
  id: string
  adminEmail: string
  note: string
  createdAt: string
}

// ---------- Rating audit ----------

export interface AuditWorkerRow {
  workerId: string
  name: string | null
  phone: string | null
  city: string | null
  avatarUrl: string | null
  warningCount: number
  totalReviews: number
  avgRating: number | null
  avgBefore: number | null
  /** avgBefore - avgRating over the last 7 days. Positive = dropped. */
  drop: number | null
  recentReviews: number
  disputes30d: number
  flags: AuditFlag[]
}

export interface AuditFilters {
  flag: 'all' | AuditFlag
  city: string
  search: string
  page: number
  pageSize: number
}

export interface AuditListResponse {
  data: AuditWorkerRow[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}