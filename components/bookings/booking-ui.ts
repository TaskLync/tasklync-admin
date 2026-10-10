// components/bookings/booking-ui.ts
// Labels, colours, formatters and stuck-detection shared by every booking component.
import type { BadgeTone } from '@/components/ui/Badge'
import type { BookingStatus, PaymentStatus } from '@/lib/booking-constants'
import type { BookingListItem } from '@/types/booking'

export { formatDate, formatPkr, initial, timeAgo } from '@/components/workers/worker-ui'

export const STATUS_TONE: Record<BookingStatus, BadgeTone> = {
  PENDING: 'warning',
  ACCEPTED: 'info',
  REJECTED: 'danger',
  IN_PROGRESS: 'info',
  COMPLETED_BY_WORKER: 'warning',
  COMPLETED: 'success',
  AUTO_COMPLETED: 'success',
  DISPUTED: 'danger',
  REFUNDED: 'neutral',
  RESOLVED: 'neutral',
  CANCELLED: 'neutral',
}

export const PAYMENT_TONE: Record<PaymentStatus, BadgeTone> = {
  paid: 'success',
  pending: 'warning',
  refunded: 'neutral',
}

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  paid: 'Paid',
  pending: 'Payment pending',
  refunded: 'Refunded',
}

export function shortId(id: string): string {
  return `#${id.slice(0, 8)}`
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`
  return `${hours} h`
}

// ---------- Stuck detection (kanban + table highlight) ----------

export type StuckLevel = 'ok' | 'amber' | 'red'

type StuckInput = Pick<
  BookingListItem,
  'status' | 'createdAt' | 'updatedAt' | 'scheduledAt' | 'startedAt' | 'durationHours'
>

/**
 * PENDING              amber 20 min / red 30 min since created (auto-cancel is at 30)
 * ACCEPTED             amber 30 min / red 2 h past the scheduled start
 * IN_PROGRESS          amber 1 h / red 3 h past the expected end
 * COMPLETED_BY_WORKER  amber 12 h / red 24 h waiting for the customer
 */
export function stuckLevel(b: StuckInput, now: number = Date.now()): StuckLevel {
  const minsSince = (iso: string) => (now - new Date(iso).getTime()) / 60_000

  switch (b.status) {
    case 'PENDING': {
      const m = minsSince(b.createdAt)
      return m >= 30 ? 'red' : m >= 20 ? 'amber' : 'ok'
    }
    case 'ACCEPTED': {
      const late = minsSince(b.scheduledAt)
      return late >= 120 ? 'red' : late >= 30 ? 'amber' : 'ok'
    }
    case 'IN_PROGRESS': {
      const over = minsSince(b.startedAt ?? b.updatedAt) - b.durationHours * 60
      return over >= 180 ? 'red' : over >= 60 ? 'amber' : 'ok'
    }
    case 'COMPLETED_BY_WORKER': {
      const h = minsSince(b.updatedAt) / 60
      return h >= 24 ? 'red' : h >= 12 ? 'amber' : 'ok'
    }
    default:
      return 'ok'
  }
}

export const STUCK_TONE: Record<StuckLevel, BadgeTone> = {
  ok: 'neutral',
  amber: 'warning',
  red: 'danger',
}

export const STUCK_LABEL: Record<StuckLevel, string> = {
  ok: '',
  amber: 'Delayed',
  red: 'Stuck',
}

// DataTable rows have `even:bg-gray-50 hover:bg-gray-50`, so the highlight needs
// important (`!` suffix, Tailwind v4) to win on every row. Same trick as SLA_ROW_CLASS.
export const STUCK_ROW_CLASS: Record<StuckLevel, string> = {
  ok: '',
  amber: 'bg-amber-50! even:bg-amber-50! hover:bg-amber-100!',
  red: 'bg-red-50! even:bg-red-50! hover:bg-red-100!',
}

export const STUCK_BORDER_CLASS: Record<StuckLevel, string> = {
  ok: '',
  amber: 'border-l-4 border-l-[#D97706]',
  red: 'border-l-4 border-l-[#DC2626]',
}