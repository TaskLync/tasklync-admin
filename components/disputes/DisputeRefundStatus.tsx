// components/disputes/DisputeRefundStatus.tsx
'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import {
  REFUND_STATUS_LABEL,
  REFUND_STATUS_TONE,
  methodLabel,
} from '@/components/payments/payment-ui'
import { isActiveDispute } from '@/lib/dispute-constants'
import type { RefundStatus } from '@/types/payment'
import type { DisputeDetail } from '@/types/dispute'
import { formatDateTime, formatPkr } from './dispute-ui'

export default function DisputeRefundStatus({ dispute }: { dispute: DisputeDetail }) {
  const { booking, refunds, refundsAvailable } = dispute
  const cur = booking.currency
  const active = isActiveDispute(dispute.status)
  const decidedRefund =
    !active &&
    dispute.resolution !== null &&
    dispute.resolution !== 'NO_REFUND' &&
    (dispute.refundAmount ?? 0) > 0

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Refund status
      </h2>

      {!refundsAvailable ? (
        <p className="text-sm text-gray-500">
          Refund records aren't available: the payments tables aren't reachable yet.
        </p>
      ) : refunds.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {refunds.map((r) => {
            const status = r.status as RefundStatus
            return (
              <li key={r.id} className="rounded-md border border-gray-100 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-gray-900">
                    {formatPkr(r.amount, cur)}{' '}
                    <span className="text-xs font-normal text-gray-400">({r.percentage}%)</span>
                  </span>
                  <Badge tone={REFUND_STATUS_TONE[status] ?? 'neutral'}>
                    {REFUND_STATUS_LABEL[status] ?? r.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Back to {methodLabel(r.method)} · started {formatDateTime(r.initiatedAt)}
                  {r.completedAt && ` · done ${formatDateTime(r.completedAt)}`}
                </p>
                {r.gatewayReference && (
                  <p className="mt-0.5 font-mono text-[11px] text-gray-400">{r.gatewayReference}</p>
                )}
                {status === 'FAILED' && (
                  <p className="mt-1.5 rounded bg-red-50 px-2 py-1 text-xs text-red-700">
                    {r.failureReason ?? 'The gateway rejected this refund.'} Finance can follow up
                    in Payments → Refunds.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      ) : active ? (
        <p className="text-sm text-gray-500">
          No refund yet. If you decide in the customer's favour, payment-service creates the refund
          record automatically.
        </p>
      ) : decidedRefund ? (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p>
            A refund of {formatPkr(dispute.refundAmount ?? 0, cur)} was decided, but payment-service
            hasn't created the record yet. This normally takes under a minute.
          </p>
          {!booking.isPaymentConfirmed ? (
            <p className="mt-1">
              Payment was never confirmed on this booking (likely cash on delivery), so there may be
              no online payment to refund. Settle it with the customer directly.
            </p>
          ) : (
            <p className="mt-1">
              If it stays empty, check that the admin outbox relay is running and look in{' '}
              <Link href="/payments?tab=refunds" className="underline">
                Payments → Refunds
              </Link>
              .
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          No refund. The decision went to the worker, so the held payment is released to them.
        </p>
      )}
    </Card>
  )
}