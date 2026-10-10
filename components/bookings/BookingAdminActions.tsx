// components/bookings/BookingAdminActions.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSWRConfig } from 'swr'
import { toast } from 'sonner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import {
  CANCELLABLE_BY_ADMIN,
  ESCALATABLE,
  OVERRIDE_TARGETS,
  REASSIGNABLE,
} from '@/lib/booking-constants'
import { usePermission } from '@/hooks/usePermission'
import {
  CancelBookingDialog,
  EscalateDialog,
  OverrideStatusDialog,
  ReassignDialog,
} from './BookingActionDialogs'
import type { BookingDetail } from '@/types/booking'

type DialogKind = 'cancel' | 'override' | 'reassign' | 'escalate' | null

export default function BookingAdminActions({ booking }: { booking: BookingDetail }) {
  const router = useRouter()
  const { mutate } = useSWRConfig()
  const [dialog, setDialog] = useState<DialogKind>(null)

  const canCancelPerm = usePermission('bookings:cancel')
  const canOverridePerm = usePermission('bookings:override')
  const canReassignPerm = usePermission('bookings:reassign')
  const canEscalatePerm = usePermission('bookings:escalate')

  const canCancel = canCancelPerm && CANCELLABLE_BY_ADMIN.includes(booking.status)
  const canOverride = canOverridePerm && (OVERRIDE_TARGETS[booking.status]?.length ?? 0) > 0
  const canReassign = canReassignPerm && REASSIGNABLE.includes(booking.status)
  const canEscalate = canEscalatePerm && ESCALATABLE.includes(booking.status) && !booking.dispute

  const anyPermission = canCancelPerm || canOverridePerm || canReassignPerm || canEscalatePerm
  const anyAvailable = canCancel || canOverride || canReassign || canEscalate

  function refreshAll() {
    const prefix = `/api/admin/bookings/${booking.id}`
    mutate((key) => typeof key === 'string' && key.startsWith(prefix))
  }

  function close() {
    setDialog(null)
  }

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Admin Actions
      </h2>

      {!anyPermission && (
        <p className="text-sm text-gray-500">You have view-only access to bookings.</p>
      )}
      {anyPermission && !anyAvailable && (
        <p className="text-sm text-gray-500">
          No admin actions apply to a booking in this state.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {canCancel && (
          <Button variant="destructive" onClick={() => setDialog('cancel')}>
            Cancel booking
          </Button>
        )}
        {canReassign && (
          <Button variant="secondary" onClick={() => setDialog('reassign')}>
            Reassign worker
          </Button>
        )}
        {canOverride && (
          <Button variant="secondary" onClick={() => setDialog('override')}>
            Override status
          </Button>
        )}
        {canEscalate && (
          <Button variant="secondary" onClick={() => setDialog('escalate')}>
            Escalate to dispute
          </Button>
        )}
      </div>

      <CancelBookingDialog
        open={dialog === 'cancel'}
        booking={booking}
        onClose={close}
        onDone={() => {
          toast.success('Booking cancelled')
          refreshAll()
        }}
      />

      <OverrideStatusDialog
        open={dialog === 'override'}
        booking={booking}
        onClose={close}
        onDone={() => {
          toast.success('Status updated')
          refreshAll()
        }}
      />

      <ReassignDialog
        open={dialog === 'reassign'}
        booking={booking}
        onClose={close}
        onDone={(result?: { newBookingId?: string }) => {
          toast.success('Booking reassigned')
          refreshAll()
          if (result?.newBookingId) router.push(`/bookings/${result.newBookingId}`)
        }}
      />

      <EscalateDialog
        open={dialog === 'escalate'}
        booking={booking}
        onClose={close}
        onDone={() => {
          toast.success('Escalated to a dispute')
          refreshAll()
        }}
      />
    </Card>
  )
}