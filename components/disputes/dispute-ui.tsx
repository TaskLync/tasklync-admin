// components/disputes/dispute-ui.tsx
// Labels, colours, SLA helpers and the 24h response-window logic shared by every dispute component.
import { useEffect, useState } from 'react'
import type { BadgeTone } from '@/components/ui/Badge'
import {
  DISPUTE_SLA_AMBER_HOURS,
  DISPUTE_SLA_RED_HOURS,
  isActiveDispute,
  type DisputeResolution,
  type DisputeStatus,
} from '@/lib/dispute-constants'

export {
  formatDate,
  formatDateTime,
  formatPkr,
  initial,
  shortId,
  timeAgo,
} from '@/components/bookings/booking-ui'
export { Field, KNOWN_CITIES, Pager, Person, SELECT_CLASS } from '@/components/payments/payment-ui'

// ---------- Status / resolution ----------

export const STATUS_LABEL: Record<DisputeStatus, string> = {
  OPEN: 'Open',
  WORKER_RESPONDED: 'Worker responded',
  UNDER_REVIEW: 'Under review',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
}

export const STATUS_TONE: Record<DisputeStatus, BadgeTone> = {
  OPEN: 'warning',
  WORKER_RESPONDED: 'info',
  UNDER_REVIEW: 'info',
  RESOLVED: 'success',
  CLOSED: 'neutral',
}

export const RESOLUTION_LABEL: Record<DisputeResolution, string> = {
  REFUND_GRANTED: 'Full refund to customer',
  PARTIAL_REFUND: 'Split decision',
  NO_REFUND: 'Sided with worker',
}

export const RESOLUTION_TONE: Record<DisputeResolution, BadgeTone> = {
  REFUND_GRANTED: 'info',
  PARTIAL_REFUND: 'warning',
  NO_REFUND: 'neutral',
}

// ---------- Age + SLA ----------

export type SlaLevel = 'ok' | 'amber' | 'red'

export function ageHours(iso: string | null | undefined, now: number = Date.now()): number {
  if (!iso) return 0
  return Math.max(0, (now - new Date(iso).getTime()) / 3_600_000)
}

export function slaLevel(iso: string | null | undefined, now: number = Date.now()): SlaLevel {
  const h = ageHours(iso, now)
  if (h >= DISPUTE_SLA_RED_HOURS) return 'red'
  if (h >= DISPUTE_SLA_AMBER_HOURS) return 'amber'
  return 'ok'
}

export function formatAge(iso: string | null | undefined, now: number = Date.now()): string {
  const h = ageHours(iso, now)
  if (h < 1) return '<1h'
  if (h < 24) return `${Math.floor(h)}h`
  const d = Math.floor(h / 24)
  const rem = Math.floor(h % 24)
  return rem ? `${d}d ${rem}h` : `${d}d`
}

export const SLA_TONE: Record<SlaLevel, BadgeTone> = {
  ok: 'neutral',
  amber: 'warning',
  red: 'danger',
}

// DataTable rows have `even:bg-gray-50 hover:bg-gray-50`, so the highlight
// needs important (`!` suffix, Tailwind v4) to win on every row.
export const SLA_ROW_CLASS: Record<SlaLevel, string> = {
  ok: '',
  amber: 'bg-amber-50! even:bg-amber-50! hover:bg-amber-100!',
  red: 'bg-red-50! even:bg-red-50! hover:bg-red-100!',
}

// ---------- Worker response window (24h) ----------

export function formatCountdown(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export type ResponseKind = 'responded' | 'waiting' | 'expired' | 'closed'

export interface ResponseState {
  kind: ResponseKind
  label: string
  tone: BadgeTone
}

export function responseState(
  d: { status: string; workerResponse: string | null; responseDueAt: string },
  now: number = Date.now()
): ResponseState {
  if (!isActiveDispute(d.status)) return { kind: 'closed', label: 'Closed', tone: 'neutral' }
  if (d.workerResponse) return { kind: 'responded', label: 'Worker responded', tone: 'success' }
  const ms = new Date(d.responseDueAt).getTime() - now
  if (ms > 0) {
    return { kind: 'waiting', label: `${formatCountdown(ms)} left for worker`, tone: 'warning' }
  }
  return { kind: 'expired', label: 'No response · window expired', tone: 'danger' }
}

/** Re-renders the caller every `ms` so countdowns stay live. */
export function useNow(ms = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

// ---------- Audit trail labels ----------

export const ACTIVITY_LABEL: Record<string, string> = {
  'dispute.claimed': 'took this dispute',
  'dispute.released': 'released this dispute',
  'dispute.escalated': 'escalated to a Super Admin',
  'dispute.resolved': 'resolved the dispute',
  'dispute.note_added': 'added an internal note',
}