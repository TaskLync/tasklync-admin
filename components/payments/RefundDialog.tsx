// components/payments/RefundDialog.tsx
'use client'

import { useState } from 'react'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { paymentActions } from '@/hooks/usePayments'
import type { TransactionRow } from '@/types/payment'
import { formatPkr, methodLabel, shortId } from './payment-ui'

export default function RefundDialog({
  row,
  onClose,
  onDone,
}: {
  row: TransactionRow
  onClose: () => void
  onDone: () => void
}) {
  const [amount, setAmount] = useState(String(row.refundable))
  const parsed = Math.round(Number(amount) * 100) / 100

  return (
    <ConfirmDialog
      open
      title={`Refund booking ${shortId(row.bookingId)}?`}
      description={`Paid by ${row.userName ?? 'the customer'} via ${methodLabel(row.method)}. The refund goes back to that same method and takes 3–5 business days.`}
      requireReason
      confirmLabel="Issue refund"
      onClose={onClose}
      onConfirm={async (reason) => {
        if (!Number.isFinite(parsed) || parsed <= 0) throw new Error('Enter an amount above zero')
        if (parsed > row.refundable) {
          throw new Error(`You can refund at most ${formatPkr(row.refundable, row.currency)}`)
        }
        await paymentActions.refund({ paymentId: row.paymentId!, amount: parsed, reason: reason! })
        onDone()
      }}
    >
      <div className="flex flex-col gap-3">
        <Input
          label={`Refund amount (${row.currency})`}
          type="number"
          min={1}
          max={row.refundable}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          helperText={`Up to ${formatPkr(row.refundable, row.currency)} of ${formatPkr(row.gross, row.currency)}.`}
        />
        {row.status === 'RELEASED' && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            The worker has already been credited for this booking. Only use this for
            finance-approved exceptions. Customer complaints should go through Disputes.
          </p>
        )}
      </div>
    </ConfirmDialog>
  )
}