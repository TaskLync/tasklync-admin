// components/shared/ConfirmDialog.tsx
'use client'

import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  /** Extra controls rendered between the description and the reason box. */
  children?: ReactNode
  /** If set, the admin must type this exact string to enable the confirm button. */
  requireTypedConfirmation?: string
  /** If set, renders a required reason textarea and passes the value to onConfirm. */
  requireReason?: boolean
  confirmLabel?: string
  destructive?: boolean
  onConfirm: (reason?: string) => Promise<void> | void
  onClose: () => void
}

export default function ConfirmDialog({
  open,
  title,
  description,
  children,
  requireTypedConfirmation,
  requireReason,
  confirmLabel = 'Confirm',
  destructive = true,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const typedOk = !requireTypedConfirmation || typed === requireTypedConfirmation
  const reasonOk = !requireReason || reason.trim().length > 0

  async function handleConfirm() {
    setError(null)
    setSubmitting(true)
    try {
      await onConfirm(requireReason ? reason.trim() : undefined)
      setTyped('')
      setReason('')
      onClose()
    } catch (e: any) {
      setError(e?.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}

        {children && <div className="mt-4">{children}</div>}

        {requireReason && (
          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-gray-700">Reason</label>
            <textarea
              className="h-20 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F6F5F]"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why — this is logged and, in most cases, shown to the user."
            />
          </div>
        )}

        {requireTypedConfirmation && (
          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Type <span className="font-mono">{requireTypedConfirmation}</span> to confirm
            </label>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} />
          </div>
        )}

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'primary'}
            onClick={handleConfirm}
            disabled={submitting || !typedOk || !reasonOk}
          >
            {submitting ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}