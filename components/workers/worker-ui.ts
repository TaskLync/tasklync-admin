// components/workers/worker-ui.ts
// Labels, colours and formatters shared by every worker component.
import { formatDistanceToNow } from 'date-fns'
import type { BadgeTone } from '@/components/ui/Badge'
import type {
  WorkerBadgeKey,
  WorkerPresence,
  WorkerStatus,
  WorkerVerificationStatus,
} from '@/types/worker'

export type StatusVariant = 'success' | 'warning' | 'danger' | 'neutral'

export const STATUS_VARIANT: Record<WorkerStatus, StatusVariant> = {
  active: 'success',
  inactive: 'neutral',
  suspended: 'warning',
  banned: 'danger',
  deleted: 'danger',
}

export const STATUS_LABEL: Record<WorkerStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  suspended: 'Suspended',
  banned: 'Banned',
  deleted: 'Deleted',
}

export const VERIFICATION_VARIANT: Record<WorkerVerificationStatus, StatusVariant> = {
  verified: 'success',
  pending_review: 'warning',
  unverified: 'neutral',
  rejected: 'danger',
  suspended: 'danger',
}

export const VERIFICATION_LABEL: Record<WorkerVerificationStatus, string> = {
  verified: 'Verified',
  pending_review: 'Pending review',
  unverified: 'Unverified',
  rejected: 'Rejected',
  suspended: 'Suspended',
}

export const PRESENCE_TONE: Record<WorkerPresence, BadgeTone> = {
  online: 'success',
  away: 'warning',
  offline: 'neutral',
  paused: 'danger',
  on_job: 'info',
}

export const PRESENCE_LABEL: Record<WorkerPresence, string> = {
  online: 'Online',
  away: 'Away',
  offline: 'Offline',
  paused: 'Paused',
  on_job: 'On job',
}

export const BADGE_LABEL: Record<WorkerBadgeKey, string> = {
  top_rated: 'Top Rated',
  background_verified: 'Background Verified',
}

export const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
]

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatPkr(amount: number | null | undefined, currency = 'PKR'): string {
  if (amount === null || amount === undefined) return '—'
  return `${currency} ${amount.toLocaleString()}`
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'never'
  return formatDistanceToNow(new Date(iso), { addSuffix: true })
}

export function initial(name: string | null | undefined): string {
  return (name ?? '?').charAt(0).toUpperCase()
}