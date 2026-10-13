// components/reviews/review-ui.tsx
// Labels, colours and small shared pieces for every review component.
import type { BadgeTone } from '@/components/ui/Badge'
import {
  AUDIT_MIN_REVIEWS,
  BURST_MIN_WORKERS,
  BURST_WINDOW_HOURS,
  COMPLAINT_MIN,
  COMPLAINT_WINDOW_DAYS,
  LOW_RATING_THRESHOLD,
  RATING_DROP_THRESHOLD,
  SHORT_COMMENT_CHARS,
  type AuditFlag,
  type ModerationStatus,
  type ReportReason,
  type ReviewSignal,
} from '@/lib/review-constants'

export {
  formatDate,
  formatDateTime,
  formatPkr,
  initial,
  shortId,
  timeAgo,
} from '@/components/bookings/booking-ui'
export { Field, KNOWN_CITIES, Pager, Person, SELECT_CLASS } from '@/components/payments/payment-ui'

// ---------- Moderation status ----------

export const MODERATION_LABEL: Record<ModerationStatus, string> = {
  VISIBLE: 'Visible',
  AUTO_HIDDEN: 'Auto-hidden',
  ADMIN_HIDDEN: 'Hidden by admin',
  ADMIN_RESTORED: 'Restored by admin',
}

export const MODERATION_TONE: Record<ModerationStatus, BadgeTone> = {
  VISIBLE: 'success',
  AUTO_HIDDEN: 'warning',
  ADMIN_HIDDEN: 'danger',
  ADMIN_RESTORED: 'info',
}

// ---------- Reports ----------

export const REASON_LABEL: Record<ReportReason, string> = {
  SPAM: 'Spam',
  OFFENSIVE_LANGUAGE: 'Offensive language',
  FAKE_REVIEW: 'Fake review',
  UNRELATED_CONTENT: 'Unrelated content',
  PERSONAL_INFO: 'Personal info',
  OTHER: 'Other',
}

// ---------- Signals (computed, not stored) ----------

export const SIGNAL_LABEL: Record<ReviewSignal, string> = {
  short_one_star: 'Short 1★',
  burst_one_star: 'Repeat 1★',
}

export const SIGNAL_HINT: Record<ReviewSignal, string> = {
  short_one_star: `1-star with under ${SHORT_COMMENT_CHARS} characters of text. Often a revenge review.`,
  burst_one_star: `This reviewer left 1-star reviews to ${BURST_MIN_WORKERS}+ different workers within ${BURST_WINDOW_HOURS}h of this one. Possible coordinated attack.`,
}

// ---------- Rating audit ----------

export const AUDIT_FLAG_LABEL: Record<AuditFlag, string> = {
  low_rating: 'Low rating',
  rapid_drop: 'Rapid drop',
  many_disputes: 'Many disputes',
}

export const AUDIT_FLAG_TONE: Record<AuditFlag, BadgeTone> = {
  low_rating: 'warning',
  rapid_drop: 'danger',
  many_disputes: 'danger',
}

export const AUDIT_FLAG_HINT: Record<AuditFlag, string> = {
  low_rating: `Average below ${LOW_RATING_THRESHOLD} with at least ${AUDIT_MIN_REVIEWS} reviews.`,
  rapid_drop: `Average fell by more than ${RATING_DROP_THRESHOLD} in the last 7 days.`,
  many_disputes: `${COMPLAINT_MIN}+ disputes raised against this worker in ${COMPLAINT_WINDOW_DAYS} days.`,
}

// ---------- Audit trail labels ----------

export const ACTIVITY_LABEL: Record<string, string> = {
  'review.hidden': 'hid this review',
  'review.restored': 'restored this review',
  'review.reports_dismissed': 'kept the review and dismissed its reports',
  'review.note_added': 'added an internal note',
}

// ---------- Small pieces ----------

export function prettify(value: string): string {
  const s = value.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function Stars({ rating, className = 'text-sm' }: { rating: number; className?: string }) {
  return (
    <span className={`whitespace-nowrap ${className}`} aria-label={`${rating} out of 5 stars`}>
      <span className="text-[#D97706]">{'★'.repeat(rating)}</span>
      <span className="text-gray-300">{'★'.repeat(Math.max(0, 5 - rating))}</span>
    </span>
  )
}