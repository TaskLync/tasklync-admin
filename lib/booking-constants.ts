// lib/booking-constants.ts
// Shared by server routes AND client components. No server-only imports here.

export const BOOKING_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'IN_PROGRESS',
  'COMPLETED_BY_WORKER',
  'COMPLETED',
  'AUTO_COMPLETED',
  'DISPUTED',
  'REFUNDED',
  'RESOLVED',
  'CANCELLED',
] as const

export type BookingStatus = (typeof BOOKING_STATUSES)[number]

export const STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  IN_PROGRESS: 'In progress',
  COMPLETED_BY_WORKER: 'Completed by worker',
  COMPLETED: 'Completed',
  AUTO_COMPLETED: 'Auto-completed',
  DISPUTED: 'Disputed',
  REFUNDED: 'Refunded',
  RESOLVED: 'Resolved',
  CANCELLED: 'Cancelled',
}

// ---------- Kanban ----------

export const BOARD_COLUMNS = [
  'pending',
  'accepted',
  'in_progress',
  'completed_by_worker',
  'completed',
  'cancelled_disputed',
] as const

export type BoardColumn = (typeof BOARD_COLUMNS)[number]

export const BOARD_COLUMN_LABEL: Record<BoardColumn, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  in_progress: 'In progress',
  completed_by_worker: 'Completed by worker',
  completed: 'Completed',
  cancelled_disputed: 'Cancelled / Disputed',
}

export const BOARD_COLUMN_HINT: Record<BoardColumn, string> = {
  pending: 'Waiting for the worker. Oldest first.',
  accepted: 'Confirmed, not started yet.',
  in_progress: 'Job is running.',
  completed_by_worker: 'Waiting for the customer to confirm (auto-completes after 24h).',
  completed: 'Completed and auto-completed, last 7 days.',
  cancelled_disputed: 'Cancelled, rejected, disputed or refunded, last 7 days.',
}

/** Completed + cancelled/disputed columns only show bookings updated in this window. */
export const BOARD_TERMINAL_DAYS = 7
export const BOARD_COLUMN_LIMIT = 20

// ---------- Payment ----------

export const PAYMENT_STATUSES = ['paid', 'pending', 'refunded'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

// ---------- Admin action rules (the server enforces the same rules) ----------

export const CANCELLABLE_BY_ADMIN: BookingStatus[] = ['PENDING', 'ACCEPTED', 'IN_PROGRESS']

/**
 * Forward-only. COMPLETED_BY_WORKER is deliberately NOT a target: it needs a 24h
 * auto-complete job that only booking-service can enqueue.
 */
export const OVERRIDE_TARGETS: Partial<Record<BookingStatus, BookingStatus[]>> = {
  PENDING: ['ACCEPTED'],
  ACCEPTED: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED_BY_WORKER: ['COMPLETED'],
}

/** booking-service state machine only allows ->DISPUTED from COMPLETED_BY_WORKER. */
export const ESCALATABLE: BookingStatus[] = ['COMPLETED_BY_WORKER']

export const REASSIGNABLE: BookingStatus[] = ['PENDING', 'ACCEPTED']

/** Must match BOOKING_TIMEOUT_MINUTES in booking-service. */
export const BOOKING_TIMEOUT_MINUTES = 30

/** Maps a status to the Kafka event booking-service would have produced. */
export const STATUS_EVENT: Partial<Record<BookingStatus, string>> = {
  ACCEPTED: 'booking.accepted',
  IN_PROGRESS: 'booking.started',
  COMPLETED: 'booking.completed',
  CANCELLED: 'booking.cancelled',
  DISPUTED: 'booking.disputed',
}

/**
 * Refund matrix from the booking-service doc (section 7):
 * PENDING 100% | ACCEPTED >24h 90% | ACCEPTED <24h 50% | IN_PROGRESS 0%
 */
export function standardRefundPercent(
  status: BookingStatus,
  scheduledAt: string | Date,
  now: Date = new Date()
): number {
  if (status === 'PENDING') return 100
  if (status === 'ACCEPTED') {
    const hoursUntil = (new Date(scheduledAt).getTime() - now.getTime()) / 3_600_000
    return hoursUntil > 24 ? 90 : 50
  }
  return 0
}