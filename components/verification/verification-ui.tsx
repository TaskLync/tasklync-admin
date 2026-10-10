// components/verification/verification-ui.ts
// Labels, colours and SLA helpers shared by every verification component.
import { SLA_AMBER_HOURS, SLA_RED_HOURS } from '@/lib/verification-constants'
import type { BadgeTone } from '@/components/ui/Badge'
import type { ReviewDecision } from '@/types/verification'

export type SlaLevel = 'ok' | 'amber' | 'red'

export function waitingHours(iso: string | null | undefined): number {
  if (!iso) return 0
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / 3_600_000)
}

export function slaLevel(iso: string | null | undefined): SlaLevel {
  const h = waitingHours(iso)
  if (h >= SLA_RED_HOURS) return 'red'
  if (h >= SLA_AMBER_HOURS) return 'amber'
  return 'ok'
}

export function formatWaiting(iso: string | null | undefined): string {
  const h = waitingHours(iso)
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

export const DECISION_LABEL: Record<ReviewDecision, string> = {
  approved: 'Approved',
  rejected: 'Rejected',
  info_requested: 'Info requested',
}

export const DECISION_VARIANT: Record<ReviewDecision, 'success' | 'danger' | 'warning'> = {
  approved: 'success',
  rejected: 'danger',
  info_requested: 'warning',
}

export const DOC_TYPE_LABEL: Record<string, string> = {
  NATIONAL_ID: 'National ID (CNIC)',
  PASSPORT: 'Passport',
  SKILL_CERTIFICATE: 'Skill certificate',
  POLICE_CLEARANCE: 'Police clearance',
}

export const DOC_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger'> = {
  APPROVED: 'success',
  PENDING: 'warning',
  REJECTED: 'danger',
}

export const DOC_STATUS_LABEL: Record<string, string> = {
  APPROVED: 'Approved',
  PENDING: 'Pending',
  REJECTED: 'Rejected',
}

export const ACTIVITY_LABEL: Record<string, string> = {
  'worker.verification_viewed': 'Opened this review',
  'worker.verification_approved': 'Approved verification',
  'worker.verification_rejected': 'Rejected verification',
  'worker.verification_info_requested': 'Requested more info',
  'worker.verification_cnic_saved': 'Saved CNIC number',
}

export function isPdf(url: string): boolean {
  return /\.pdf($|\?)/i.test(url)
}