// lib/review-constants.ts
// Shared by server routes AND client components. No server-only imports here.

// ---------- review-service enums ----------

export const MODERATION_STATUSES = [
  'VISIBLE',
  'AUTO_HIDDEN',
  'ADMIN_HIDDEN',
  'ADMIN_RESTORED',
] as const
export type ModerationStatus = (typeof MODERATION_STATUSES)[number]

/** Shown on the public worker profile. NOTE: ADMIN_RESTORED is public too (see backend contract #2). */
export const PUBLIC_STATUSES: readonly ModerationStatus[] = ['VISIBLE', 'ADMIN_RESTORED']

export function isPubliclyVisible(status: string): boolean {
  return (PUBLIC_STATUSES as readonly string[]).includes(status)
}

export const REPORT_REASONS = [
  'SPAM',
  'OFFENSIVE_LANGUAGE',
  'FAKE_REVIEW',
  'UNRELATED_CONTENT',
  'PERSONAL_INFO',
  'OTHER',
] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

// ---------- queue ----------

export const REVIEW_TABS = ['flagged', 'all', 'audit'] as const
export type ReviewTab = (typeof REVIEW_TABS)[number]

/** Tabs backed by the review list endpoint. 'audit' has its own endpoint. */
export const REVIEW_LIST_TABS = ['flagged', 'all'] as const
export type ReviewListTab = (typeof REVIEW_LIST_TABS)[number]

// ---------- rules ----------

/** Mirrors review-service AUTO_HIDE_REPORT_THRESHOLD (display only). */
export const AUTO_HIDE_REPORT_THRESHOLD = 3
export const REVIEW_EDIT_WINDOW_HOURS = 48

/** Signals computed in SQL (spec 10.1 triggers that review-service does not implement). */
export const REVIEW_SIGNALS = ['short_one_star', 'burst_one_star'] as const
export type ReviewSignal = (typeof REVIEW_SIGNALS)[number]
export const SHORT_COMMENT_CHARS = 20
export const BURST_WINDOW_HOURS = 24
export const BURST_MIN_WORKERS = 2

/** Rating audit (spec 10.3). */
export const AUDIT_FLAGS = ['low_rating', 'rapid_drop', 'many_disputes'] as const
export type AuditFlag = (typeof AUDIT_FLAGS)[number]
export const LOW_RATING_THRESHOLD = 3.5
export const RATING_DROP_THRESHOLD = 0.5
export const AUDIT_MIN_REVIEWS = 3
export const COMPLAINT_WINDOW_DAYS = 30
export const COMPLAINT_MIN = 3

export const NOTE_MAX_LENGTH = 1000

// ---------- moderation transitions ----------

export const MODERATION_ACTIONS = ['hide', 'restore', 'dismiss'] as const
export type ModerationAction = (typeof MODERATION_ACTIONS)[number]

export function canHide(status: string): boolean {
  return status === 'VISIBLE' || status === 'AUTO_HIDDEN' || status === 'ADMIN_RESTORED'
}

export function canRestore(status: string): boolean {
  return status === 'AUTO_HIDDEN' || status === 'ADMIN_HIDDEN'
}

/**
 * Status after applying an action, or null if the action is not allowed.
 * dismiss = "keep the review": an auto-hidden review is restored, a visible one stays as is.
 */
export function resultingStatus(
  action: ModerationAction,
  current: string
): ModerationStatus | null {
  if (action === 'hide') return canHide(current) ? 'ADMIN_HIDDEN' : null
  if (action === 'restore') return canRestore(current) ? 'ADMIN_RESTORED' : null
  // dismiss
  if (current === 'AUTO_HIDDEN') return 'ADMIN_RESTORED'
  if (current === 'VISIBLE' || current === 'ADMIN_RESTORED') return current
  return null
}