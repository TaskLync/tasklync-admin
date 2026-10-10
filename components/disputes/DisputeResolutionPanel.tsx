// components/disputes/DisputeResolutionPanel.tsx  (spec 7.2d)
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { isActiveDispute } from '@/lib/dispute-constants'
import { useAdminSession } from '@/hooks/useAdminSession'
import { usePermission } from '@/hooks/usePermission'
import { disputeActions } from '@/hooks/useDisputes'
import type { DisputeDetail } from '@/types/dispute'
import { EscalateDisputeDialog, ResolveDialog, type ResolveMode } from './DisputeResolutionDialogs'
import {
  RESOLUTION_LABEL,
  RESOLUTION_TONE,
  formatDateTime,
  formatPkr,
  responseState,
  useNow,
} from './dispute-ui'

type DialogKind = ResolveMode | 'escalate' | null

export default function DisputeResolutionPanel({
  dispute,
  onChanged,
}: {
  dispute: DisputeDetail
  onChanged: () => void
}) {
  const { admin } = useAdminSession()
  const canAssign = usePermission('disputes:assign')
  const canResolve = usePermission('disputes:resolve')
  const canEscalate = usePermission('disputes:escalate')
  const now = useNow(30_000)

  const [dialog, setDialog] = useState<DialogKind>(null)
  const [busy, setBusy] = useState(false)

  const active = isActiveDispute(dispute.status)
  const isSuper = admin?.role === 'SUPER_ADMIN'
  const blockedByEscalation = dispute.isEscalated && !isSuper
  const bookingDisputed = dispute.booking.status === 'DISPUTED'
  const resp = responseState(dispute, now)

  const assignee = dispute.assignedTo
  const canClaim =
    canAssign && !blockedByEscalation && (!assignee || (!dispute.assignedToMe && isSuper))
  const canRelease = canAssign && !!assignee && (dispute.assignedToMe || isSuper)

  async function assign(action: 'claim' | 'release') {
    setBusy(true)
    try {
      await disputeActions.assign(dispute.id, action)
      toast.success(action === 'claim' ? 'Dispute assigned to you' : 'Dispute released')
      onChanged()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  // ---------- Already decided ----------
  if (!active) {
    return (
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Decision
        </h2>
        <div className="flex flex-col gap-2 text-sm text-gray-700">
          <div className="flex flex-wrap items-center gap-2">
            {dispute.resolution ? (
              <Badge tone={RESOLUTION_TONE[dispute.resolution]}>
                {RESOLUTION_LABEL[dispute.resolution]}
              </Badge>
            ) : (
              <Badge tone="neutral">Closed</Badge>
            )}
            {dispute.refundAmount !== null && dispute.refundAmount > 0 && (
              <span className="font-medium text-gray-900">
                {formatPkr(dispute.refundAmount, dispute.booking.currency)} refunded
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Decided by {dispute.resolvedByName ?? 'an admin'} on {formatDateTime(dispute.resolvedAt)}.
            The decision can't be changed from the admin panel.
          </p>
        </div>
      </Card>
    )
  }

  // ---------- Active ----------
  const warnings: string[] = []
  if (blockedByEscalation) {
    warnings.push('Escalated: only a Super Admin can resolve this dispute.')
  }
  if (!bookingDisputed) {
    warnings.push(
      `The booking is ${dispute.booking.status.replace(/_/g, ' ').toLowerCase()}, not disputed, so it can't be resolved from here.`
    )
  }

  const resolveDisabled = blockedByEscalation || !bookingDisputed

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Decision</h2>

      {/* Assignment */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm">
        <span className="text-gray-600">
          {assignee ? (
            <>
              Assigned to{' '}
              <span className="font-medium text-gray-900">
                {dispute.assignedToMe ? 'you' : (assignee.name ?? assignee.email ?? 'an admin')}
              </span>
            </>
          ) : (
            'Unassigned'
          )}
        </span>
        <div className="flex gap-2">
          {canClaim && (
            <Button size="sm" variant="secondary" loading={busy} onClick={() => assign('claim')}>
              {assignee ? 'Take over' : 'Take this dispute'}
            </Button>
          )}
          {canRelease && (
            <Button size="sm" variant="ghost" loading={busy} onClick={() => assign('release')}>
              Release
            </Button>
          )}
        </div>
      </div>

      {!canResolve && !canEscalate && (
        <p className="text-sm text-gray-500">You have view-only access to disputes.</p>
      )}
      {canResolve && !canEscalate && null}

      {resp.kind === 'waiting' && canResolve && (
        <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          The worker still has time to respond ({resp.label}). You can decide now, but you'll be
          asked to confirm you're not waiting.
        </p>
      )}

      {warnings.length > 0 && (
        <ul className="mb-3 flex flex-col gap-1 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {warnings.map((w) => (
            <li key={w}>• {w}</li>
          ))}
        </ul>
      )}

      {canResolve && (
        <div className="flex flex-wrap gap-2">
          <Button disabled={resolveDisabled} onClick={() => setDialog('customer')}>
            Resolve for customer
          </Button>
          <Button variant="secondary" disabled={resolveDisabled} onClick={() => setDialog('split')}>
            Split decision
          </Button>
          <Button variant="secondary" disabled={resolveDisabled} onClick={() => setDialog('worker')}>
            Resolve for worker
          </Button>
        </div>
      )}

      {canEscalate && !dispute.isEscalated && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <Button variant="ghost" onClick={() => setDialog('escalate')}>
            Escalate to Super Admin
          </Button>
        </div>
      )}

      <p className="mt-3 text-xs text-gray-400">
        Every decision needs a note, is written to the audit log, and notifies both parties.
      </p>

      {(dialog === 'customer' || dialog === 'split' || dialog === 'worker') && (
        <ResolveDialog
          mode={dialog}
          dispute={dispute}
          onClose={() => setDialog(null)}
          onDone={() => {
            toast.success('Dispute resolved')
            onChanged()
          }}
        />
      )}

      {dialog === 'escalate' && (
        <EscalateDisputeDialog
          dispute={dispute}
          onClose={() => setDialog(null)}
          onDone={() => {
            toast.success('Escalated to a Super Admin')
            onChanged()
          }}
        />
      )}
    </Card>
  )
}