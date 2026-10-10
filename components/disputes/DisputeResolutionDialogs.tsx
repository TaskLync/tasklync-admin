// components/disputes/DisputeResolutionDialogs.tsx
// Resolve (customer / split / worker) and Escalate dialogs.
'use client'

import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  NOTE_MAX_LENGTH,
  roundMoney,
  type DisputeResolution,
} from '@/lib/dispute-constants'
import { disputeActions } from '@/hooks/useDisputes'
import type { DisputeDetail } from '@/types/dispute'
import { formatDateTime, formatPkr, responseState, useNow } from './dispute-ui'

const TEXTAREA_CLASS =
  'h-24 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F6F5F]'

function Modal({
  title,
  description,
  children,
  error,
  submitting,
  submitLabel,
  submitDisabled,
  destructive,
  onSubmit,
  onClose,
}: {
  title: string
  description?: string
  children: ReactNode
  error: string | null
  submitting: boolean
  submitLabel: string
  submitDisabled: boolean
  destructive: boolean
  onSubmit: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
        <div className="mt-4 flex flex-col gap-4">{children}</div>
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'primary'}
            onClick={onSubmit}
            disabled={submitting || submitDisabled}
          >
            {submitting ? 'Working…' : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

function NoteField({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  placeholder?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-700">{label}</label>
      <textarea
        className={TEXTAREA_CLASS}
        value={value}
        maxLength={NOTE_MAX_LENGTH}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

/** Runs the action, closes, surfaces the error. */
function useSubmit(onDone: () => void, onClose: () => void) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(fn: () => Promise<unknown>) {
    setError(null)
    setSubmitting(true)
    try {
      await fn()
      onClose()
      onDone()
    } catch (e: any) {
      setError(e?.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }
  return { submitting, error, run }
}

// ---------- Resolve ----------

export type ResolveMode = 'customer' | 'split' | 'worker'

const TITLE: Record<ResolveMode, string> = {
  customer: 'Resolve for the customer',
  split: 'Split decision',
  worker: 'Resolve for the worker',
}

const DESCRIPTION: Record<ResolveMode, string> = {
  customer:
    'The customer is refunded. If only part of the amount, the rest is released to the worker. Both parties are notified.',
  split:
    'Both sides get part of the money. Set what percentage goes back to the customer. Both parties are notified.',
  worker:
    'No refund. The held payment is released to the worker and the customer is told the decision.',
}

interface ResolveProps {
  mode: ResolveMode
  dispute: DisputeDetail
  onClose: () => void
  onDone: () => void
}

export function ResolveDialog({ mode, dispute, onClose, onDone }: ResolveProps) {
  const now = useNow(30_000)
  const [customerChoice, setCustomerChoice] = useState<'full' | 'partial'>('full')
  const [percent, setPercent] = useState(mode === 'split' ? '50' : '')
  const [note, setNote] = useState('')
  const [override, setOverride] = useState(false)
  const { submitting, error, run } = useSubmit(onDone, onClose)

  const total = dispute.booking.estimatedTotal
  const cur = dispute.booking.currency
  const waiting = responseState(dispute, now).kind === 'waiting'

  const isPartial = mode === 'split' || (mode === 'customer' && customerChoice === 'partial')
  const pct = Number(percent)
  const pctValid = !isPartial || (percent.trim() !== '' && Number.isFinite(pct) && pct > 0 && pct < 100)

  const refund =
    mode === 'worker' ? 0 : isPartial ? (pctValid ? roundMoney((total * pct) / 100) : 0) : total
  const amountValid = !isPartial || (pctValid && refund > 0 && refund < total)

  const resolution: DisputeResolution =
    mode === 'worker' ? 'NO_REFUND' : isPartial ? 'PARTIAL_REFUND' : 'REFUND_GRANTED'

  const remainder = roundMoney(total - refund)

  return (
    <Modal
      title={TITLE[mode]}
      description={DESCRIPTION[mode]}
      error={error}
      submitting={submitting}
      submitLabel="Confirm decision"
      submitDisabled={!note.trim() || !amountValid || (waiting && !override)}
      destructive={false}
      onSubmit={() =>
        run(() =>
          disputeActions.resolve(dispute.id, {
            resolution,
            refundAmount: resolution === 'PARTIAL_REFUND' ? refund : undefined,
            note: note.trim(),
            overrideWindow: waiting && override ? true : undefined,
          })
        )
      }
      onClose={onClose}
    >
      {mode === 'customer' && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-gray-700">How much to refund</label>
          {(
            [
              { key: 'full', label: 'Full refund (100%)', hint: 'The customer gets everything back.' },
              { key: 'partial', label: 'Partial refund', hint: 'Choose a percentage below.' },
            ] as const
          ).map((o) => (
            <label
              key={o.key}
              className={`flex cursor-pointer items-start gap-2 rounded-md border p-2.5 text-sm ${
                customerChoice === o.key ? 'border-[#1F6F5F] bg-[#1F6F5F]/5' : 'border-gray-200'
              }`}
            >
              <input
                type="radio"
                name="customer-refund"
                className="mt-0.5 accent-[#1F6F5F]"
                checked={customerChoice === o.key}
                onChange={() => setCustomerChoice(o.key)}
              />
              <span>
                <span className="font-medium text-gray-900">{o.label}</span>
                <span className="block text-xs text-gray-400">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
      )}

      {isPartial && (
        <Input
          label={
            mode === 'split'
              ? 'Percentage returned to the customer'
              : 'Percentage refunded to the customer'
          }
          type="number"
          min={1}
          max={99}
          step="1"
          placeholder="e.g. 50"
          value={percent}
          onChange={(e) => setPercent(e.target.value)}
          error={percent.trim() !== '' && !pctValid ? 'Enter a percentage between 1 and 99' : undefined}
          helperText={percent.trim() === '' || pctValid ? 'Use "Resolve for the customer" with full refund for 100%.' : undefined}
        />
      )}

      <div className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
        <div className="flex items-center justify-between">
          <span>Booking total</span>
          <span className="font-medium">{formatPkr(total, cur)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Refund to customer</span>
          <span className="font-semibold">
            {amountValid ? formatPkr(refund, cur) : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Released to worker side</span>
          <span className="font-medium">{amountValid ? formatPkr(remainder, cur) : '—'}</span>
        </div>
        <p className="mt-1 text-[11px] text-gray-400">
          payment-service works out the final worker payout, including the platform fee.
        </p>
        {!dispute.booking.isPaymentConfirmed && (
          <p className="mt-1.5 text-xs text-amber-700">
            Payment isn't confirmed on this booking (likely cash on delivery), so there may be no
            online money to move.
          </p>
        )}
      </div>

      {waiting && (
        <label className="flex cursor-pointer items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-[#1F6F5F]"
            checked={override}
            onChange={(e) => setOverride(e.target.checked)}
          />
          <span>
            Resolve without waiting for the worker.
            <span className="block text-amber-700">
              They can still respond until {formatDateTime(dispute.responseDueAt)}. Ticking this is
              written to the audit log.
            </span>
          </span>
        </label>
      )}

      <NoteField
        value={note}
        onChange={setNote}
        label="Resolution note (logged, and included in the notification)"
        placeholder="e.g. Photos and chat show the leak was not fixed. Refunding in full."
      />

      <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
        This is final. Once confirmed it queues the refund / release in payment-service and can't be
        undone from the admin panel.
      </p>
    </Modal>
  )
}

// ---------- Escalate ----------

export function EscalateDisputeDialog({
  dispute,
  onClose,
  onDone,
}: {
  dispute: DisputeDetail
  onClose: () => void
  onDone: () => void
}) {
  const [note, setNote] = useState('')
  const { submitting, error, run } = useSubmit(onDone, onClose)

  return (
    <Modal
      title="Escalate to a Super Admin"
      description="Moves this dispute to the Escalated tab and clears the assignment. Only a Super Admin can resolve it from there."
      error={error}
      submitting={submitting}
      submitLabel="Escalate"
      submitDisabled={!note.trim()}
      destructive={false}
      onSubmit={() => run(() => disputeActions.escalate(dispute.id, { note: note.trim() }))}
      onClose={onClose}
    >
      <NoteField
        value={note}
        onChange={setNote}
        label="Why does this need a Super Admin?"
        placeholder="e.g. Amount is large and both sides have strong evidence. Needs a second opinion."
      />
    </Modal>
  )
}