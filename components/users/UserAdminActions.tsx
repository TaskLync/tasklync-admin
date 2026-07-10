// components/users/UserAdminActions.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {Card} from '@/components/ui/Card'
import {Button} from '@/components/ui/Button'
import {Input} from '@/components/ui/Input'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { usePermission } from '@/hooks/usePermission'
import { userActions } from '@/hooks/useUsers'
import type { UserDetail } from '@/types/user'

type DialogKind = 'warn' | 'suspend' | 'ban' | 'edit' | null

export default function UserAdminActions({
  user,
  onChanged,
}: {
  user: UserDetail
  onChanged: () => void
}) {
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [suspendDuration, setSuspendDuration] = useState<'7d' | '30d' | 'custom'>('7d')
  const [suspendUntil, setSuspendUntil] = useState('')
  const [editPhone, setEditPhone] = useState(user.phone ?? '')
  const [editEmail, setEditEmail] = useState(user.email ?? '')

  const canWarn = usePermission('users:warn')
  const canSuspend = usePermission('users:suspend')
  const canBan = usePermission('users:ban')
  const canEdit = usePermission('users:edit')
  const canImpersonate = usePermission('users:impersonate')

  async function handleUnsuspend() {
    try {
      await userActions.unsuspend(user.id)
      toast.success('Suspension lifted')
      onChanged()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  async function handleImpersonate() {
    try {
      const res = await userActions.impersonate(user.id)
      window.open(res.impersonationUrl, '_blank')
      toast.success('Impersonation session started — logged to the audit trail')
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Admin Actions</h2>
      <div className="flex flex-wrap gap-2">
        {canWarn && (
          <Button variant="secondary" onClick={() => setDialog('warn')}>Send warning</Button>
        )}

        {canSuspend && user.status !== 'suspended' && (
          <Button variant="secondary" onClick={() => setDialog('suspend')}>Suspend</Button>
        )}
        {canSuspend && user.status === 'suspended' && (
          <Button variant="secondary" onClick={handleUnsuspend}>Lift suspension</Button>
        )}

        {canBan && user.status !== 'banned' && (
          <Button variant="destructive" onClick={() => setDialog('ban')}>Ban permanently</Button>
        )}

        {canEdit && (
          <Button variant="secondary" onClick={() => setDialog('edit')}>Edit phone/email</Button>
        )}

        {canImpersonate && (
          <Button variant="secondary" onClick={handleImpersonate} title="Opens a 20-minute impersonation session, fully logged">
            Impersonate user
          </Button>
        )}
      </div>

      {/* Warn */}
      <ConfirmDialog
        open={dialog === 'warn'}
        title={`Warn ${user.name ?? 'this user'}?`}
        description="This increments their warning count and is visible in their audit trail."
        requireReason
        confirmLabel="Send warning"
        destructive={false}
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => {
          await userActions.warn(user.id, reason!)
          toast.success('Warning sent')
          onChanged()
        }}
      />

      {/* Suspend */}
      <ConfirmDialog
        open={dialog === 'suspend'}
        title={`Suspend ${user.name ?? 'this user'}?`}
        description="They won't be able to book while suspended."
        requireReason
        confirmLabel="Suspend"
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => {
          await userActions.suspend(user.id, reason!, suspendDuration, suspendUntil || undefined)
          toast.success('User suspended')
          onChanged()
        }}
      >
        {/* duration controls are rendered inline below via children slot pattern —
            if ConfirmDialog doesn't support children in your build, lift this
            block into its own small dialog component; logic is identical. */}
      </ConfirmDialog>
      {dialog === 'suspend' && (
        <div className="fixed inset-0 z-40 flex items-end justify-center pb-24 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-md rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
            <label className="mb-1 block text-xs font-medium text-gray-700">Duration</label>
            <div className="flex gap-2">
              {(['7d', '30d', 'custom'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setSuspendDuration(d)}
                  className={`h-8 rounded-md border px-3 text-xs ${
                    suspendDuration === d ? 'border-[--accent] text-[--accent]' : 'border-gray-300 text-gray-600'
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
          </div>
        </div>
      )}

      {/* Ban */}
      <ConfirmDialog
        open={dialog === 'ban'}
        title={`Ban ${user.name ?? 'this user'} permanently?`}
        description="This is a serious, hard-to-reverse action. The user will be logged out and blocked from booking."
        requireReason
        requireTypedConfirmation={user.name ?? 'BAN'}
        confirmLabel="Ban permanently"
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => {
          await userActions.ban(user.id, reason!)
          toast.success('User banned')
          onChanged()
        }}
      />

      {/* Edit contact */}
      {dialog === 'edit' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Edit contact info</h2>
            <p className="mt-1 text-sm text-gray-600">For support cases where the user is locked out.</p>
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
                onClick={async () => {
                  try {
                    await userActions.editContact(user.id, editPhone, editEmail)
                    toast.success('Contact info updated')
                    setDialog(null)
                    onChanged()
                  } catch (e: any) {
                    toast.error(e.message)
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