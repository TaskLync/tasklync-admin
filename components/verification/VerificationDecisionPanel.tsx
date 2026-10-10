// components/verification/VerificationDecisionPanel.tsx  (spec 2.2d)
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { usePermission } from '@/hooks/usePermission'
import { verificationActions } from '@/hooks/useVerification'
import { formatDate } from '@/components/workers/worker-ui'
import { rejectionLabel } from '@/lib/verification-constants'
import { InfoRequestDialog, RejectDialog } from './DecisionDialogs'
import type { VerificationDetail } from '@/types/verification'

type DialogKind = 'approve' | 'reject' | 'info' | null

export default function VerificationDecisionPanel({
  detail,
  onChanged,
}: {
  detail: VerificationDetail
  onChanged: () => void
}) {
  const router = useRouter()
  const canVerify = usePermission('workers:verify')
  const [dialog, setDialog] = useState<DialogKind>(null)

  const { worker, documents, cnicDuplicates } = detail
  const name = worker.name?.trim() || 'this worker'
  const pending = worker.verificationStatus === 'pending_review'

  const hasIdentityDoc = documents.some(
    (d) => (d.type === 'NATIONAL_ID' || d.type === 'PASSPORT') && d.status !== 'REJECTED'
  )

  // Blockers mirror the server-side rules in approve-verification.
  const blockers: string[] = []
  if (!hasIdentityDoc) blockers.push('No identity document (CNIC or passport) on file.')
  if (cnicDuplicates.length > 0) blockers.push('Another account uses this CNIC number.')
  if (worker.accountStatus === 'banned') blockers.push('This account is banned.')

  const warnings: string[] = []
  if (!worker.cnicNumber) {
    warnings.push('CNIC number not saved: run the duplicate check first.')
  }

  function backToQueue() {
    router.push('/workers/verification')
  }

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Decision</h2>

      {!canVerify ? (
        <p className="text-sm text-gray-500">You don't have access to verification decisions.</p>
      ) : !pending ? (
        <div className="text-sm text-gray-600">
          {worker.verificationStatus === 'verified' && (
            <p>This worker is verified. Use “Request re-verification” on their worker profile if documents are outdated.</p>
          )}
          {worker.verificationStatus === 'rejected' && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              <p className="font-medium">Rejected: {rejectionLabel(worker.rejectionCode)}</p>
              {worker.rejectionNote && <p className="mt-1">{worker.rejectionNote}</p>}
              <p className="mt-1">
                Resubmission {worker.resubmissionAllowed ? 'allowed' : 'not allowed'}.
              </p>
            </div>
          )}
          {worker.verificationStatus !== 'verified' && worker.verificationStatus !== 'rejected' && (
            <p>This worker is not awaiting review (status: {worker.verificationStatus.replace('_', ' ')}).</p>
          )}
        </div>
      ) : (
        <>
          {blockers.length > 0 && (
            <ul className="mb-3 flex flex-col gap-1 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              {blockers.map((b) => (
                <li key={b}>• {b}</li>
              ))}
            </ul>
          )}
          {warnings.length > 0 && (
            <ul className="mb-3 flex flex-col gap-1 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {warnings.map((w) => (
                <li key={w}>• {w}</li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={blockers.length > 0}
              title={blockers.length > 0 ? blockers[0] : undefined}
              onClick={() => setDialog('approve')}
            >
              Approve
            </Button>
            <Button variant="destructive" onClick={() => setDialog('reject')}>
              Reject
            </Button>
            <Button variant="secondary" onClick={() => setDialog('info')}>
              Request more info
            </Button>
          </div>
          <p className="mt-3 text-xs text-gray-400">
            Every decision is written to the audit log and notifies the worker.
          </p>
        </>
      )}

      {/* Approve */}
      <ConfirmDialog
        open={dialog === 'approve'}
        title={`Approve ${name}?`}
        description="They become Verified, appear in search results, and get a push + SMS."
        confirmLabel="Approve"
        destructive={false}
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          await verificationActions.approve(worker.id)
          toast.success(`${name} approved`)
          onChanged()
          backToQueue()
        }}
      >
        {warnings.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {warnings.map((w) => (
              <li key={w}>• {w}</li>
            ))}
          </ul>
        )}
      </ConfirmDialog>

      {/* Reject */}
      <RejectDialog
        open={dialog === 'reject'}
        workerName={name}
        onClose={() => setDialog(null)}
        onSubmit={async (v) => {
          await verificationActions.reject(worker.id, v)
          toast.success(`${name} rejected`)
          onChanged()
          backToQueue()
        }}
      />

      {/* Request info */}
      <InfoRequestDialog
        open={dialog === 'info'}
        workerName={name}
        onClose={() => setDialog(null)}
        onSubmit={async (message) => {
          await verificationActions.requestInfo(worker.id, message)
          toast.success('Request sent')
          onChanged()
        }}
      />

      {worker.verificationStatus === 'verified' && worker.reverificationReason && (
        <p className="mt-3 text-xs text-gray-400">Last re-verification: {formatDate(worker.createdAt)}</p>
      )}
    </Card>
  )
}