// components/bookings/BookingActionDialogs.tsx
// Cancel (refund policy selector), Override status, Reassign worker, Escalate to dispute.
'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import {
  OVERRIDE_TARGETS,
  STATUS_LABEL,
  standardRefundPercent,
  type BookingStatus,
} from '@/lib/booking-constants'
import { bookingActions, useReassignCandidates } from '@/hooks/useBookings'
import { PRESENCE_LABEL, PRESENCE_TONE } from '@/components/workers/worker-ui'
import type { WorkerPresence } from '@/types/worker'
import type { BookingDetail } from '@/types/booking'
import { formatPkr } from './booking-ui'

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

function ReasonField({
  value,
  onChange,
  label = 'Reason (logged in the audit trail)',
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  label?: string
  placeholder?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-700">{label}</label>
      <textarea
        className={TEXTAREA_CLASS}
        value={value}
        maxLength={1000}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

/** Shared submit wrapper: runs the action, resets, closes, surfaces the error. */
function useSubmit(onDone: (result?: any) => void, onClose: () => void) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(fn: () => Promise<any>) {
    setError(null)
    setSubmitting(true)
    try {
      const result = await fn()
      onClose()
      onDone(result)
    } catch (e: any) {
      setError(e?.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }
  return { submitting, error, run, setError }
}

interface DialogProps {
  open: boolean
  booking: BookingDetail
  onClose: () => void
  onDone: (result?: any) => void
}

// ---------- Cancel ----------

type Policy = 'standard' | 'full' | 'none' | 'custom'

export function CancelBookingDialog({ open, booking, onClose, onDone }: DialogProps) {
  const [policy, setPolicy] = useState<Policy>('standard')
  const [custom, setCustom] = useState('')
  const [reason, setReason] = useState('')
  const { submitting, error, run } = useSubmit(onDone, onClose)

  if (!open) return null

  const standard = standardRefundPercent(booking.status, booking.scheduledAt)
  const pct =
    policy === 'standard' ? standard : policy === 'full' ? 100 : policy === 'none' ? 0 : Number(custom)
  const customEmpty = policy === 'custom' && custom.trim() === ''
  const pctValid = !customEmpty && Number.isFinite(pct) && pct >= 0 && pct <= 100
  const refundAmount = pctValid ? Math.round(booking.pricing.estimatedTotal * pct) / 100 : 0

  const options: { key: Policy; label: string; hint: string }[] = [
    {
      key: 'standard',
      label: `Standard policy (${standard}%)`,
      hint: 'Pending 100% · Accepted >24h before start 90% · Accepted <24h 50% · In progress 0%',
    },
    { key: 'full', label: 'Full refund (100%)', hint: 'Use when the platform or worker is at fault.' },
    { key: 'none', label: 'No refund (0%)', hint: 'Use when the customer is at fault.' },
    { key: 'custom', label: 'Custom percentage', hint: 'Anything from 0 to 100.' },
  ]

  return (
    <Modal
      title={`Cancel booking ${'#' + booking.id.slice(0, 8)}?`}
      description="Both parties are told the booking is cancelled. payment-service issues the refund."
      error={error}
      submitting={submitting}
      submitLabel="Cancel booking"
      submitDisabled={!reason.trim() || !pctValid}
      destructive
      onSubmit={() =>
        run(() => bookingActions.cancel(booking.id, { reason: reason.trim(), refundPercent: pct }))
      }
      onClose={onClose}
    >
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-gray-700">Refund policy</label>
        {options.map((o) => (
          <label
            key={o.key}
            className={`flex cursor-pointer items-start gap-2 rounded-md border p-2.5 text-sm ${
              policy === o.key ? 'border-[#1F6F5F] bg-[#1F6F5F]/5' : 'border-gray-200'
            }`}
          >
            <input
              type="radio"
              name="refund-policy"
              className="mt-0.5 accent-[#1F6F5F]"
              checked={policy === o.key}
              onChange={() => setPolicy(o.key)}
            />
            <span>
              <span className="font-medium text-gray-900">{o.label}</span>
              <span className="block text-xs text-gray-400">{o.hint}</span>
            </span>
          </label>
        ))}
        {policy === 'custom' && (
          <Input
            type="number"
            min={0}
            max={100}
            placeholder="e.g. 75"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
        )}
      </div>

      <div className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
        Refund:{' '}
        <span className="font-semibold">
          {pctValid ? `${pct}% = ${formatPkr(refundAmount, booking.pricing.currency)}` : '—'}
        </span>
        {!booking.isPaymentConfirmed && (
          <span className="mt-1 block text-xs text-amber-700">
            Payment isn't confirmed on this booking, so there may be nothing to refund.
          </span>
        )}
      </div>

      <ReasonField value={reason} onChange={setReason} />
    </Modal>
  )
}

// ---------- Override status ----------

export function OverrideStatusDialog({ open, booking, onClose, onDone }: DialogProps) {
  const targets = OVERRIDE_TARGETS[booking.status] ?? []
  const [toStatus, setToStatus] = useState<BookingStatus | ''>('')
  const [reason, setReason] = useState('')
  const { submitting, error, run } = useSubmit(onDone, onClose)

  useEffect(() => {
    if (open) setToStatus(targets[0] ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, booking.status])

  if (!open) return null

  return (
    <Modal
      title="Override booking status"
      description={`Currently ${STATUS_LABEL[booking.status].toLowerCase()}. Use this when the app state is wrong, for example the worker forgot to tap a button.`}
      error={error}
      submitting={submitting}
      submitLabel="Apply override"
      submitDisabled={!toStatus || !reason.trim()}
      destructive={toStatus === 'COMPLETED'}
      onSubmit={() =>
        run(() =>
          bookingActions.overrideStatus(booking.id, {
            toStatus: toStatus as BookingStatus,
            reason: reason.trim(),
          })
        )
      }
      onClose={onClose}
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">Move to</label>
        <select
          className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm"
          value={toStatus}
          onChange={(e) => setToStatus(e.target.value as BookingStatus)}
        >
          {targets.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {toStatus === 'COMPLETED' && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          Completing a booking releases the payment to the worker
          ({formatPkr(booking.pricing.workerAmount, booking.pricing.currency)}). This can't be undone.
        </p>
      )}
      {toStatus === 'ACCEPTED' && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Accepting on the worker's behalf opens the chat room and triggers the payment hold.
        </p>
      )}

      <ReasonField value={reason} onChange={setReason} />
    </Modal>
  )
}

// ---------- Reassign ----------

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export function ReassignDialog({ open, booking, onClose, onDone }: DialogProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const debounced = useDebounced(query, 300)
  const { candidates, isLoading } = useReassignCandidates(booking.id, debounced, open)
  const { submitting, error, run } = useSubmit(onDone, onClose)

  if (!open) return null

  return (
    <Modal
      title="Reassign to another worker"
      description="Creates a new pending booking for the new worker at the same quoted price and cancels this one with no penalty. The new worker has 30 minutes to accept."
      error={error}
      submitting={submitting}
      submitLabel="Reassign booking"
      submitDisabled={!selected || !reason.trim()}
      destructive={false}
      onSubmit={() =>
        run(() =>
          bookingActions.reassign(booking.id, { newWorkerId: selected as string, reason: reason.trim() })
        )
      }
      onClose={onClose}
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">
          Find a worker (verified, free at this time, same category)
        </label>
        <Input
          placeholder="Search by name or phone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="max-h-56 overflow-y-auto rounded-md border border-gray-200">
        {isLoading && candidates.length === 0 ? (
          <div className="flex flex-col gap-2 p-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : candidates.length === 0 ? (
          <p className="p-4 text-center text-sm text-gray-400">No available workers match.</p>
        ) : (
          candidates.map((c) => (
            <label
              key={c.id}
              className={`flex cursor-pointer items-center gap-2 border-b border-gray-100 p-2.5 text-sm last:border-0 ${
                selected === c.id ? 'bg-[#1F6F5F]/5' : 'hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="reassign-worker"
                className="accent-[#1F6F5F]"
                checked={selected === c.id}
                onChange={() => setSelected(c.id)}
              />
              <span className="min-w-0 flex-1">
                <span className="font-medium text-gray-900">{c.name ?? 'Unnamed'}</span>
                <span className="block text-xs text-gray-400">
                  {c.totalReviews > 0 ? `★ ${c.avgRating.toFixed(1)} (${c.totalReviews})` : 'No reviews'}
                  {c.city && ` · ${c.city}`} · {c.phone ?? '—'}
                </span>
              </span>
              <Badge tone={PRESENCE_TONE[c.presence as WorkerPresence] ?? 'neutral'}>
                {PRESENCE_LABEL[c.presence as WorkerPresence] ?? c.presence}
              </Badge>
            </label>
          ))
        )}
      </div>

      <ReasonField value={reason} onChange={setReason} />
    </Modal>
  )
}

// ---------- Escalate ----------

export function EscalateDialog({ open, booking, onClose, onDone }: DialogProps) {
  const [reason, setReason] = useState('')
  const { submitting, error, run } = useSubmit(onDone, onClose)

  if (!open) return null

  return (
    <Modal
      title="Escalate to dispute"
      description="Opens a dispute on behalf of the customer, freezes the booking as Disputed and notifies the worker. The dispute then goes to the Disputes queue."
      error={error}
      submitting={submitting}
      submitLabel="Escalate to dispute"
      submitDisabled={!reason.trim()}
      destructive
      onSubmit={() => run(() => bookingActions.escalate(booking.id, { reason: reason.trim() }))}
      onClose={onClose}
    >
      <ReasonField
        value={reason}
        onChange={setReason}
        label="What is the issue? (shown to the dispute reviewer)"
        placeholder="e.g. Customer says the leak is still there and the worker has left the site."
      />
    </Modal>
  )
}