// components/workers/WorkerAdminActions.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { usePermission } from '@/hooks/usePermission'
import { workerActions } from '@/hooks/useWorkers'
import { BADGE_LABEL } from './worker-ui'
import type { WorkerBadgeKey, WorkerDetail } from '@/types/worker'

type DialogKind = 'warn' | 'suspend' | 'ban' | 'edit' | 'reverify' | 'offline' | null

const BADGE_KEYS: WorkerBadgeKey[] = ['top_rated', 'background_verified']

export default function WorkerAdminActions({
  worker,
  onChanged,
}: {
  worker: WorkerDetail
  onChanged: () => void
}) {
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [suspendDuration, setSuspendDuration] = useState<'7d' | '30d' | 'custom'>('7d')
  const [suspendUntil, setSuspendUntil] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')

  const canWarn = usePermission('workers:warn')
  const canSuspend = usePermission('workers:suspend')
  const canBan = usePermission('workers:ban')
  const canEdit = usePermission('workers:edit')
  const canFeature = usePermission('workers:feature')
  const canBadge = usePermission('workers:badge')
  const canForceOffline = usePermission('workers:force-offline')
  const canVerify = usePermission('workers:verify')

  const name = worker.name?.trim() || 'this worker'
  const isLive = ['online', 'away', 'on_job'].includes(worker.presence)

  async function run(key: string, fn: () => Promise<unknown>, success: string) {
    setBusy(key)
    try {
      await fn()
      toast.success(success)
      onChanged()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(null)
    }
  }

  function openEdit() {
    setEditPhone(worker.phone ?? '')
    setEditEmail(worker.email ?? '')
    setDialog('edit')
  }

  const hasAnyAction =
    canWarn || canSuspend || canBan || canEdit || canFeature || canBadge || canForceOffline || canVerify

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Admin Actions</h2>

      {!hasAnyAction && (
        <p className="text-sm text-gray-500">You have view-only access to workers.</p>
      )}

      <div className="flex flex-wrap gap-2">
        {canWarn && (
          <Button variant="secondary" onClick={() => setDialog('warn')}>Send warning</Button>
        )}

        {canSuspend && worker.status !== 'suspended' && worker.status !== 'banned' && (
          <Button variant="secondary" onClick={() => setDialog('suspend')}>Suspend</Button>
        )}
        {canSuspend && worker.status === 'suspended' && (
          <Button
            variant="secondary"
            loading={busy === 'unsuspend'}
            onClick={() =>
              run('unsuspend', () => workerActions.unsuspend(worker.id), 'Suspension lifted')
            }
          >
            Lift suspension
          </Button>
        )}

        {canBan && worker.status !== 'banned' && (
          <Button variant="destructive" onClick={() => setDialog('ban')}>Ban permanently</Button>
        )}

        {canEdit && (
          <Button variant="secondary" onClick={openEdit}>Edit phone/email</Button>
        )}

        {canForceOffline && isLive && (
          <Button
            variant="secondary"
            onClick={() => setDialog('offline')}
            title="Pauses the worker and marks them offline"
          >
            Force offline
          </Button>
        )}

        {canVerify && worker.verificationStatus === 'verified' && (
          <Button variant="secondary" onClick={() => setDialog('reverify')}>
            Request re-verification
          </Button>
        )}

        {canFeature && (
          <Button
            variant="secondary"
            loading={busy === 'feature'}
            onClick={() =>
              run(
                'feature',
                () => workerActions.setFeatured(worker.id, !worker.isFeatured),
                worker.isFeatured ? 'Removed from featured' : 'Worker featured'
              )
            }
          >
            {worker.isFeatured ? 'Remove featured' : 'Feature worker'}
          </Button>
        )}
      </div>

      {canBadge && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <p className="mb-2 text-xs font-medium text-gray-700">Badges</p>
          <div className="flex flex-wrap gap-2">
            {BADGE_KEYS.map((key) => {
              const has = worker.badges.includes(key)
              return (
                <Button
                  key={key}
                  size="sm"
                  variant={has ? 'primary' : 'secondary'}
                  loading={busy === `badge:${key}`}
                  onClick={() =>
                    run(
                      `badge:${key}`,
                      () => workerActions.setBadge(worker.id, key, has ? 'remove' : 'add'),
                      has ? `${BADGE_LABEL[key]} removed` : `${BADGE_LABEL[key]} awarded`
                    )
                  }
                >
                  {has ? `✓ ${BADGE_LABEL[key]}` : `Award ${BADGE_LABEL[key]}`}
                </Button>
              )
            })}
          </div>
        </div>
      )}

      {/* Warn */}
      <ConfirmDialog
        open={dialog === 'warn'}
        title={`Warn ${name}?`}
        description="This increments their warning count and is visible in their audit trail."
        requireReason
        confirmLabel="Send warning"
        destructive={false}
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => {
          await workerActions.warn(worker.id, reason!)
          toast.success('Warning sent')
          onChanged()
        }}
      />

      {/* Suspend: the duration picker lives inside the dialog via the children slot */}
      <ConfirmDialog
        open={dialog === 'suspend'}
        title={`Suspend ${name}?`}
        description="They will be removed from search and can't accept bookings while suspended."
        requireReason
        confirmLabel="Suspend"
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => {
          if (suspendDuration === 'custom' && !suspendUntil) {
            throw new Error('Pick an end date and time')
          }
          await workerActions.suspend(
            worker.id,
            reason!,
            suspendDuration,
            suspendDuration === 'custom' ? new Date(suspendUntil).toISOString() : undefined
          )
          toast.success('Worker suspended')
          onChanged()
        }}
      >
        <label className="mb-1 block text-xs font-medium text-gray-700">Duration</label>
        <div className="flex gap-2">
          {(['7d', '30d', 'custom'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setSuspendDuration(d)}
              className={`h-8 rounded-md border px-3 text-xs ${
                suspendDuration === d
                  ? 'border-[#1F6F5F] text-[#1F6F5F]'
                  : 'border-gray-300 text-gray-600'
              }`}
            >
              {d === '7d' ? '7 days' : d === '30d' ? '30 days' : 'Custom'}
            </button>
          ))}
        </div>
        {suspendDuration === 'custom' && (
          <Input
            type="datetime-local"
            className="mt-2"
            value={suspendUntil}
            onChange={(e) => setSuspendUntil(e.target.value)}
          />
        )}
      </ConfirmDialog>

      {/* Ban */}
      <ConfirmDialog
        open={dialog === 'ban'}
        title={`Ban ${name} permanently?`}
        description="This is a serious, hard-to-reverse action. The worker is removed from search and can't accept bookings."
        requireReason
        requireTypedConfirmation={worker.name?.trim() || 'BAN'}
        confirmLabel="Ban permanently"
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => {
          await workerActions.ban(worker.id, reason!)
          toast.success('Worker banned')
          onChanged()
        }}
      />

      {/* Force offline */}
      <ConfirmDialog
        open={dialog === 'offline'}
        title={`Force ${name} offline?`}
        description="Sets them to paused and marks them offline. They can resume from the app."
        requireReason
        confirmLabel="Force offline"
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => {
          await workerActions.forceOffline(worker.id, reason!)
          toast.success('Worker forced offline')
          onChanged()
        }}
      />

      {/* Request re-verification */}
      <ConfirmDialog
        open={dialog === 'reverify'}
        title={`Request re-verification from ${name}?`}
        description="They go back to Unverified and leave search results until they re-submit documents."
        requireReason
        confirmLabel="Request re-verification"
        destructive={false}
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => {
          await workerActions.requestReverification(worker.id, reason!)
          toast.success('Re-verification requested')
          onChanged()
        }}
      />

      {/* Edit contact */}
      {dialog === 'edit' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Edit contact info</h2>
            <p className="mt-1 text-sm text-gray-600">For support cases where the worker is locked out.</p>
            <div className="mt-4 flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Phone</label>
                <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Email</label>
                <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDialog(null)}>Cancel</Button>
              <Button
                loading={busy === 'edit'}
                onClick={async () => {
                  setBusy('edit')
                  try {
                    await workerActions.editContact(worker.id, editPhone, editEmail)
                    toast.success('Contact info updated')
                    setDialog(null)
                    onChanged()
                  } catch (e: any) {
                    toast.error(e.message)
                  } finally {
                    setBusy(null)
                  }
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}