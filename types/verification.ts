// types/verification.ts
import type {
  WorkerDocumentRow,
  WorkerSkillRow,
  WorkerStatus,
  WorkerVerificationStatus,
} from '@/types/worker'
import type { QueueTab } from '@/lib/verification-constants'

export type { QueueTab }

export type ReviewDecision = 'approved' | 'rejected' | 'info_requested'

// ---- Queue ----

export interface VerificationQueueItem {
  id: string
  name: string | null
  phone: string | null
  city: string | null
  avatarUrl: string | null
  categories: string | null
  verificationStatus: WorkerVerificationStatus
  /** Oldest pending document (the SLA clock) */
  submittedAt: string
  pendingDocs: number
  totalDocs: number
  isResubmission: boolean
  lastDecision: ReviewDecision | null
  lastReasonCode: string | null
  lastNote: string | null
  lastAdminEmail: string | null
  lastDecisionAt: string | null
}

export interface VerificationQueueResponse {
  data: VerificationQueueItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface VerificationQueueFilters {
  tab: QueueTab
  search: string
  city: string | 'all'
  categoryId: string | 'all'
  page: number
  pageSize: number
}

export interface VerificationCounts {
  pending: number
  resubmitted: number
  approved: number
  rejected: number
  overdue48h: number
  overdue72h: number
}

// ---- Review page ----

export interface VerificationWorker {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  city: string | null
  avatarUrl: string | null
  bio: string | null
  yearsExperience: number
  createdAt: string
  lastSeenAt: string | null
  warningCount: number
  dateOfBirth: string | null
  registrationIp: string | null
  cnicNumber: string | null
  verificationStatus: WorkerVerificationStatus
  accountStatus: WorkerStatus
  isResubmission: boolean
  waitingSince: string | null
  rejectionCode: string | null
  rejectionNote: string | null
  resubmissionAllowed: boolean
  reverificationReason: string | null
}

export interface CnicDuplicate {
  id: string
  name: string | null
  phone: string | null
  verificationStatus: WorkerVerificationStatus
}

export interface VerificationReview {
  id: string
  decision: ReviewDecision
  reasonCode: string | null
  note: string | null
  allowResubmission: boolean | null
  adminEmail: string
  createdAt: string
}

export interface VerificationActivity {
  id: string
  action: string
  adminEmail: string | null
  notes: string | null
  createdAt: string
}

export interface VerificationDetail {
  worker: VerificationWorker
  documents: WorkerDocumentRow[]
  skills: WorkerSkillRow[]
  cnicDuplicates: CnicDuplicate[]
  reviews: VerificationReview[]
  activity: VerificationActivity[]
}