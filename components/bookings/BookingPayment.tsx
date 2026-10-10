// components/bookings/BookingPayment.tsx
'use client'

import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { BadgeTone } from '@/components/ui/Badge'
import { useBookingPayment } from '@/hooks/useBookings'
import { formatDateTime, formatPkr } from './booking-ui'
import type { BookingPaymentData } from '@/types/booking'

type Escrow = { label: string; tone: BadgeTone }

function escrowState(p: BookingPaymentData): Escrow {
  const latest = p.payments[0]?.status?.toUpperCase()
  if (latest === 'HELD') return { label: 'Held in escrow', tone: 'warning' }
  if (latest === 'RELEASED') return { label: 'Released to worker', tone: 'success' }
  if (latest === 'FAILED') return { label: 'Payment failed', tone: 'danger' }
  if (latest && latest.includes('REFUND')) return { label: 'Refunded', tone: 'neutral' }
  if ((p.refundAmount ?? 0) > 0) return { label: 'Refunded', tone: 'neutral' }
  return p.isPaymentConfirmed
    ? { label: 'Paid', tone: 'success' }
    : { label: 'Not charged yet', tone: 'neutral' }
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0 text-gray-500">{label}</span>
      <span className="break-all text-right text-gray-900">{children}</span>
    </div>
  )
}

export default function BookingPayment({ bookingId }: { bookingId: string }) {
  const { payment, isLoading, error, mutate } = useBookingPayment(bookingId)

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Payment</h2>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 w-full animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      ) : error || !payment ? (
        <p className="text-sm text-gray-500">
          Couldn't load payment details.{' '}
          <button onClick={() => mutate()} className="text-[#1F6F5F] hover:underline">
            Retry
          </button>
        </p>
      ) : (
        <>
          {(() => {
            const escrow = escrowState(payment)
            const cur = payment.currency
            return (
              <div>
                <div className="mb-2">
                  <Badge tone={escrow.tone}>{escrow.label}</Badge>
                </div>
                <Row label="Charge amount">{formatPkr(payment.estimatedTotal, cur)}</Row>
                <Row label="Platform fee">{formatPkr(payment.platformFee, cur)}</Row>
                <Row label="Worker payout">{formatPkr(payment.workerAmount, cur)}</Row>
                {(payment.refundAmount ?? 0) > 0 && (
                  <Row label="Refunded">
                    {formatPkr(payment.refundAmount, cur)}
                    {payment.refundPercentage !== null && ` (${payment.refundPercentage}%)`}
                  </Row>
                )}
                <Row label="Payment reference">
                  <span className="font-mono text-xs">{payment.paymentIntentId ?? '—'}</span>
                </Row>
              </div>
            )
          })()}

          {!payment.available ? (
            <p className="mt-3 text-xs text-gray-400">
              Escrow timeline isn't available: the payments table isn't reachable yet.
            </p>
          ) : payment.payments.length === 0 ? (
            <p className="mt-3 text-xs text-gray-400">No payment record exists for this booking yet.</p>
          ) : (
            <div className="mt-3 border-t border-gray-100 pt-3">
              <p className="mb-1 text-xs font-medium text-gray-700">Payment records</p>
              <ul className="flex flex-col gap-1.5">
                {payment.payments.map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-xs text-gray-600">
                    <span>
                      <span className="font-medium">{r.status}</span> · {formatDateTime(r.createdAt)}
                    </span>
                    <span>{r.amount !== null ? formatPkr(r.amount, payment.currency) : '—'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Card>
  )
}