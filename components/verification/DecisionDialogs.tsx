// components/verification/DecisionDialogs.tsx
// Reject + Request-more-info dialogs. Same look as ConfirmDialog.
'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { REJECTION_REASONS, type RejectionCode } from '@/lib/verification-constants'
import { DOC_STATUS_LABEL, DOC_TYPE_LABEL } from './verification-ui'
import type { WorkerDocumentRow } from '@/types/worker'

/** worker-service stores at most 500 characters per note */
const NOTE_MAX = 500

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
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
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

const TEXTAREA_CLASS =
  'h-24 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F6F5F]'

// ---------- Reject ----------

type FlaggedDocs = Record<string, { checked: boolean; note: string }>

/** Pending uploads are flagged by default (the previous behaviour); approved ones are not. */
function defaultFlags(documents: WorkerDocumentRow[]): FlaggedDocs {
  return Object.fromEntries(documents.map((d) => [d.id, { checked: d.status === 'PENDING', note: '' }]))
}

export function RejectDialog({
  open,
  workerName,
  documents = [],
  onClose,
  onSubmit,
}: {
  open: boolean
  workerName: string
  /** latest upload per document type; the admin picks which ones the worker must replace */
  documents?: WorkerDocumentRow[]
  onClose: () => void
  onSubmit: (v: {
    reasonCode: RejectionCode
    note: string
    allowResubmission: boolean
    rejectedDocuments?: { id: string; note?: string }[]
  }) => Promise<void>
}) {
  const [reasonCode, setReasonCode] = useState<RejectionCode | ''>('')
  const [note, setNote] = useState('')
  const [allowResubmission, setAllowResubmission] = useState(true)
  const [flags, setFlags] = useState<FlaggedDocs>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fresh defaults every time the dialog opens (documents may have changed since last time).
  useEffect(() => {
    if (open) setFlags(defaultFlags(documents))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const flaggedCount = documents.filter((d) => flags[d.id]?.checked).length

  function reset() {
    setReasonCode('')
    setNote('')
    setAllowResubmission(true)
    setFlags({})
    setError(null)
  }

  function setFlag(id: string, patch: Partial<{ checked: boolean; note: string }>) {
    setFlags((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { checked: false, note: '' }), ...patch } }))
  }

  async function submit() {
    if (!reasonCode || submitting) return
    setError(null)
    setSubmitting(true)
    try {
      // Only send an explicit list when we know the documents; otherwise worker-service applies the
      // legacy rule (every pending document rejected).
      const rejectedDocuments =
        documents.length > 0
          ? documents
              .filter((d) => flags[d.id]?.checked)
              .map((d) => {
                const docNote = flags[d.id]?.note.trim()
                return docNote ? { id: d.id, note: docNote } : { id: d.id }
              })
          : undefined
      await onSubmit({ reasonCode, note: note.trim(), allowResubmission, rejectedDocuments })
      reset()
      onClose()
    } catch (e: any) {
      setError(e?.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={`Reject ${workerName}?`}
      description="The worker gets a push notification with your note and the documents to replace (no SMS)."
      error={error}
      submitting={submitting}
      submitLabel="Reject application"
      submitDisabled={!reasonCode || note.trim().length === 0}
      destructive
      onSubmit={submit}
      onClose={() => {
        reset()
        onClose()
      }}
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">Reason</label>
        <select
          className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm"
          value={reasonCode}
          onChange={(e) => setReasonCode(e.target.value as RejectionCode | '')}
        >
          <option value="">Select a reason…</option>
          {REJECTION_REASONS.map((r) => (
            <option key={r.code} value={r.code}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">
          Note for the worker (they will see this)
        </label>
        <textarea
          className={TEXTAREA_CLASS}
          value={note}
          maxLength={NOTE_MAX}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. The back of your CNIC is blurry. Please upload a clear photo in good light."
        />
      </div>

      {documents.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-gray-700">Documents the worker must replace</p>
          <ul className="flex flex-col gap-2">
            {documents.map((d) => {
              const flag = flags[d.id] ?? { checked: false, note: '' }
              return (
                <li key={d.id} className="rounded-md border border-gray-200 px-3 py-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#1F6F5F]"
                      checked={flag.checked}
                      onChange={(e) => setFlag(d.id, { checked: e.target.checked })}
                    />
                    <span className="flex-1">{DOC_TYPE_LABEL[d.type] ?? d.type}</span>
                    <span className="text-xs text-gray-400">{DOC_STATUS_LABEL[d.status] ?? d.status}</span>
                  </label>
                  {flag.checked && (
                    <input
                      type="text"
                      className="mt-2 h-8 w-full rounded-md border border-gray-300 px-2 text-xs"
                      value={flag.note}
                      maxLength={NOTE_MAX}
                      onChange={(e) => setFlag(d.id, { note: e.target.value })}
                      placeholder="What is wrong with this document? (optional, defaults to the note above)"
                    />
                  )}
                </li>
              )
            })}
          </ul>
          <p className="mt-1 text-xs text-gray-400">
            {flaggedCount === 0
              ? 'No document flagged: the worker keeps every upload and only fixes what your note describes.'
              : 'Unticked documents keep their status, so the worker does not upload them again.'}
          </p>
        </div>
      )}

      <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-[#1F6F5F]"
          checked={allowResubmission}
          onChange={(e) => setAllowResubmission(e.target.checked)}
        />
        <span>
          Allow resubmission
          <span className="block text-xs text-gray-400">
            Untick for fake or fraudulent applications. The worker will not be able to upload again.
          </span>
        </span>
      </label>
    </Modal>
  )
}

// ---------- Request more info ----------

export function InfoRequestDialog({
  open,
  workerName,
  onClose,
  onSubmit,
}: {
  open: boolean
  workerName: string
  onClose: () => void
  onSubmit: (message: string) => Promise<void>
}) {
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function submit() {
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit(message.trim())
      setMessage('')
      onClose()
    } catch (e: any) {
      setError(e?.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={`Ask ${workerName} for more info`}
      description="The application stays in the queue. The worker is notified and can reply."
      error={error}
      submitting={submitting}
      submitLabel="Send request"
      submitDisabled={message.trim().length === 0}
      destructive={false}
      onSubmit={submit}
      onClose={() => {
        setMessage('')
        setError(null)
        onClose()
      }}
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">Message to worker</label>
        <textarea
          className={TEXTAREA_CLASS}
          value={message}
          maxLength={1000}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. Your CNIC number doesn't match the name on your profile. Can you confirm?"
        />
      </div>
    </Modal>
  )
}