// lib/dispute-constants.ts
// Shared by server routes AND client components. No server-only imports here.

// ---------- booking-service enums (disputes.status / disputes.resolution) ----------

export const DISPUTE_STATUSES = [
  'OPEN',
  'WORKER_RESPONDED',
  'UNDER_REVIEW',
  'RESOLVED',
  'CLOSED',
] as const
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number]

/** Statuses where an admin decision is still pending. */
export const ACTIVE_DISPUTE_STATUSES: readonly DisputeStatus[] = [
  'OPEN',
  'WORKER_RESPONDED',
  'UNDER_REVIEW',
]

export function isActiveDispute(status: string): boolean {
  return (ACTIVE_DISPUTE_STATUSES as readonly string[]).includes(status)
}

export const DISPUTE_RESOLUTIONS = ['REFUND_GRANTED', 'NO_REFUND', 'PARTIAL_REFUND'] as const
export type DisputeResolution = (typeof DISPUTE_RESOLUTIONS)[number]

// ---------- queue ----------

export const DISPUTE_TABS = ['open', 'awaiting', 'escalated', 'resolved'] as const
export type DisputeTab = (typeof DISPUTE_TABS)[number]

export const DISPUTE_VIEWS = ['disputes', 'refunds'] as const
export type DisputeView = (typeof DISPUTE_VIEWS)[number]

// ---------- rules ----------

/** The worker gets this long to answer before the dispute becomes "Open" for a decision. */
export const RESPONSE_WINDOW_HOURS = 24

/** SLA badges (spec 7.1): amber after 48h, red after 72h. */
export const DISPUTE_SLA_AMBER_HOURS = 48
export const DISPUTE_SLA_RED_HOURS = 72

/** Resolved tab only shows decisions from this many days back. */
export const RESOLVED_WINDOW_DAYS = 30

/** booking escalate action (bookings/[id]/actions/escalate) prefixes the reason with this. */
export const ADMIN_OPENED_PREFIX = '[Opened by admin]'

export const NOTE_MAX_LENGTH = 1000

// ---------- helpers ----------

export const roundMoney = (n: number) => Math.round(n * 100) / 100

export function refundPercentage(total: number, refund: number): number {
  return total > 0 ? roundMoney((refund / total) * 100) : 0
}

/** payment-service test 25: any refund -> booking REFUNDED. Siding with the worker -> RESOLVED. */
export function bookingStatusForResolution(r: DisputeResolution): 'REFUNDED' | 'RESOLVED' {
  return r === 'NO_REFUND' ? 'RESOLVED' : 'REFUNDED'
}

export function stripAdminPrefix(reason: string): string {
  return reason.startsWith(ADMIN_OPENED_PREFIX)
    ? reason.slice(ADMIN_OPENED_PREFIX.length).trim()
    : reason
}