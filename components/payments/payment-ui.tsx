// components/payments/payment-ui.tsx
// Labels, colours and small shared pieces for every payments component.
import type { BadgeTone } from '@/components/ui/Badge'
import type {
  LedgerMethod,
  LedgerStatus,
  PayoutStatus,
  RefundReason,
  RefundStatus,
} from '@/types/payment'

export { formatDateTime, formatPkr, shortId } from '@/components/bookings/booking-ui'

export const KNOWN_CITIES = ['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi']

export const SELECT_CLASS = 'h-9 rounded-md border border-gray-300 px-3 text-sm'

export const METHOD_LABEL: Record<LedgerMethod, string> = {
  COD: 'Cash on delivery',
  JAZZCASH_WALLET: 'JazzCash wallet',
  JAZZCASH_CARD: 'JazzCash card',
  EASYPAISA_WALLET: 'Easypaisa',
  BANK_CARD: 'Bank card',
  RAAST: 'Raast',
  IBFT: 'IBFT',
}

export const LEDGER_STATUS_LABEL: Record<LedgerStatus, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  HELD: 'Held (escrow)',
  RELEASED: 'Released',
  REFUNDED: 'Refunded',
  PARTIALLY_REFUNDED: 'Partially refunded',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
  COD_COLLECTED: 'COD collected',
}

export const LEDGER_STATUS_TONE: Record<LedgerStatus, BadgeTone> = {
  PENDING: 'warning',
  PROCESSING: 'info',
  HELD: 'info',
  RELEASED: 'success',
  REFUNDED: 'neutral',
  PARTIALLY_REFUNDED: 'neutral',
  FAILED: 'danger',
  CANCELLED: 'neutral',
  EXPIRED: 'neutral',
  COD_COLLECTED: 'success',
}

export const PAYOUT_STATUS_LABEL: Record<PayoutStatus, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  COMPLETED: 'Paid',
  FAILED: 'Failed',
  REVERSED: 'Reversed',
}

export const PAYOUT_STATUS_TONE: Record<PayoutStatus, BadgeTone> = {
  PENDING: 'warning',
  PROCESSING: 'info',
  COMPLETED: 'success',
  FAILED: 'danger',
  REVERSED: 'neutral',
}

export const REFUND_STATUS_LABEL: Record<RefundStatus, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  COMPLETED: 'Refunded',
  FAILED: 'Failed',
}

export const REFUND_STATUS_TONE: Record<RefundStatus, BadgeTone> = {
  PENDING: 'warning',
  PROCESSING: 'info',
  COMPLETED: 'success',
  FAILED: 'danger',
}

export const REFUND_REASON_LABEL: Record<RefundReason, string> = {
  BOOKING_CANCELLED_BEFORE_ACCEPT: 'Cancelled before accept',
  BOOKING_CANCELLED_AFTER_ACCEPT: 'Cancelled after accept',
  BOOKING_CANCELLED_LATE: 'Late cancellation',
  DISPUTE_RESOLVED_REFUND: 'Dispute: full refund',
  DISPUTE_RESOLVED_PARTIAL: 'Dispute: partial refund',
  ADMIN_MANUAL_REFUND: 'Manual refund (admin)',
}

export function methodLabel(method: string): string {
  return METHOD_LABEL[method as LedgerMethod] ?? method
}

// ---------- Shared bits ----------

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-700">{label}</label>
      {children}
    </div>
  )
}

export function Person({ name, phone }: { name: string | null; phone: string | null }) {
  return (
    <div className="leading-tight">
      <span className="font-medium text-gray-900">{name ?? 'Unknown'}</span>
      {phone && <span className="block font-mono text-[11px] text-gray-400">{phone}</span>}
    </div>
  )
}

export function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
}) {
  if (total === 0) return null
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <div className="flex items-center justify-between text-sm text-gray-500">
      <span>
        {start}–{end} of {total.toLocaleString()}
      </span>
      <div className="flex gap-2">
        <button
          className="h-9 rounded-md border border-gray-300 px-3 disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </button>
        <button
          className="h-9 rounded-md border border-gray-300 px-3 disabled:opacity-40"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  )
}