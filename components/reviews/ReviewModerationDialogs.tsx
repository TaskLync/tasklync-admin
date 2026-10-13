// components/reviews/ReviewModerationDialogs.tsx
// Hide, Restore, Keep (dismiss reports) and Warn-reviewer dialogs.
'use client'

import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { NOTE_MAX_LENGTH, type ModerationAction } from '@/lib/review-constants'
import { reviewActions } from '@/hooks/useReviews'
import { userActions } from '@/hooks/useUsers'
import type { ReviewDetail } from '@/types/review'
import { shortId } from './review-ui'

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

// ---------- Moderate (hide / restore / dismiss) ----------

const COPY: Record<
  ModerationAction,
  {
    title: string
    description: string
    label: string
    submit: string
    placeholder: string
    destructive: boolean
  }
> = {
  hide: {
    title: 'Hide this review',
    description:
      'It disappears from the public worker profile and from the rating summary. It is never deleted, and you can restore it later.',
    label: 'Reason (logged in the audit trail)',
    submit: 'Hide review',
    placeholder: 'e.g. Confirmed fake: the booking address does not match the worker’s service area.',
    destructive: true,
  },
  restore: {
    title: 'Restore this review',
    description:
      'It becomes visible again on the worker profile and counts toward the rating summary. Open reports are closed.',
    label: 'Reason (logged in the audit trail)',
    submit: 'Restore review',
    placeholder: 'e.g. Verified the booking is genuine. The reports were unfounded.',
    destructive: false,
  },
  dismiss: {
    title: 'Keep this review',
    description:
      'Closes the open reports and leaves the review as it is. If it was auto-hidden, it becomes visible again.',
    label: 'Why are the reports not valid? (logged)',
    submit: 'Keep review',
    placeholder: 'e.g. Honest but unflattering feedback. Does not break any rule.',
    destructive: false,
  },
}

export function ModerateReviewDialog({
  action,
  review,
  onClose,
  onDone,
}: {
  action: ModerationAction
  review: ReviewDetail
  onClose: () => void
  onDone: () => void
}) {
  const [note, setNote] = useState('')
  const { submitting, error, run } = useSubmit(onDone, onClose)
  const c = COPY[action]

  return (
    <Modal
      title={c.title}
      description={c.description}
      error={error}
      submitting={submitting}
      submitLabel={c.submit}
      submitDisabled={!note.trim()}
      destructive={c.destructive}
      onSubmit={() => run(() => reviewActions.moderate(review.id, { action, note: note.trim() }))}
      onClose={onClose}
    >
      {review.comment?.trim() && (
        <div className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
          <p className="line-clamp-4 whitespace-pre-wrap break-words">{review.comment}</p>
        </div>
      )}
      <NoteField value={note} onChange={setNote} label={c.label} placeholder={c.placeholder} />
    </Modal>
  )
}

// ---------- Warn the reviewer ----------
// Reuses POST /api/admin/users/[userId]/actions/warn (permission users:warn).

const WARN_TEMPLATES = [
  { key: 'abusive', label: 'Abusive language', text: 'Abusive or offensive language in a review' },
  { key: 'fake', label: 'Fake or revenge review', text: 'Fake, retaliatory or coordinated reviews' },
  { key: 'personal', label: 'Sharing personal information', text: 'Sharing personal information in a review' },
  { key: 'custom', label: 'Custom', text: '' },
] as const

export function WarnReviewerDialog({
  review,
  onClose,
  onDone,
}: {
  review: ReviewDetail
  onClose: () => void
  onDone: () => void
}) {
  const [template, setTemplate] = useState<(typeof WARN_TEMPLATES)[number]['key']>('abusive')
  const [custom, setCustom] = useState('')
  const { submitting, error, run } = useSubmit(onDone, onClose)

  const userId = review.reviewer.id
  const base =
    template === 'custom'
      ? custom.trim()
      : (WARN_TEMPLATES.find((t) => t.key === template)?.text ?? '')
  const reason = base ? `Review ${shortId(review.id)}: ${base}` : ''

  return (
    <Modal
      title="Warn the reviewer"
      description={`Adds a warning to ${review.reviewer.name ?? 'this customer'} (${review.reviewer.warningCount} so far). This does not hide the review.`}
      error={error}
      submitting={submitting}
      submitLabel="Send warning"
      submitDisabled={!userId || !base}
      destructive={false}
      onSubmit={() => run(() => userActions.warn(userId as string, reason))}
      onClose={onClose}
    >
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-gray-700">Reason</label>
        {WARN_TEMPLATES.map((t) => (
          <label
            key={t.key}
            className={`flex cursor-pointer items-center gap-2 rounded-md border p-2.5 text-sm ${
              template === t.key ? 'border-[#1F6F5F] bg-[#1F6F5F]/5' : 'border-gray-200'
            }`}
          >
            <input
              type="radio"
              name="warn-template"
              className="accent-[#1F6F5F]"
              checked={template === t.key}
              onChange={() => setTemplate(t.key)}
            />
            <span className="text-gray-900">{t.label}</span>
          </label>
        ))}
      </div>

      {template === 'custom' && (
        <NoteField
          value={custom}
          onChange={setCustom}
          label="Custom reason"
          placeholder="Explain what the customer did wrong."
        />
      )}
    </Modal>
  )
}