// app/api/admin/bookings/[bookingId]/actions/escalate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { isUuid } from '@/lib/workers-api'
import { ESCALATABLE } from '@/lib/booking-constants'
import {
  BookingActionError,
  bookingErrorResponse,
  bookingNotFound,
  enqueueBookingEvent,
  lockBooking,
  setActor,
  withTx,
} from '@/lib/bookings-api'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const guard = await requirePermission('bookings:escalate')
  if (!guard.ok) return guard.response

  const { bookingId } = await params
  if (!isUuid(bookingId)) return bookingNotFound()

  const body = await req.json().catch(() => ({}))
  const reason: string = String(body.reason ?? '').trim()
  if (!reason) {
    return NextResponse.json({ error: 'A reason is required' }, { status: 400 })
  }

  const adminEmail = guard.admin.adminEmail

  try {
    const result = await withTx(async (client) => {
      await setActor(client, adminEmail)
      const b = await lockBooking(client, bookingId)

      if (!ESCALATABLE.includes(b.status)) {
        throw new BookingActionError(
          422,
          'Only bookings waiting for customer confirmation (Completed by worker) can be escalated to a dispute.'
        )
      }

      // The partial unique index on disputes(booking_id) turns a duplicate into 23505 -> 409.
      const dispute = await client.query(
        `INSERT INTO disputes (booking_id, raised_by, raised_against, status, reason)
         VALUES ($1, $2, $3, 'OPEN', $4)
         RETURNING id`,
        [bookingId, b.userId, b.workerId, `[Opened by admin] ${reason}`]
      )
      const disputeId: string = dispute.rows[0].id

      await client.query(
        `UPDATE bookings SET status = 'DISPUTED', updated_at = now() WHERE id = $1`,
        [bookingId]
      )

      await enqueueBookingEvent(client, b, {
        eventType: 'booking.disputed',
        status: 'DISPUTED',
        adminEmail,
        data: { dispute_id: disputeId, opened_by_admin: true, reason },
      })

      return { disputeId }
    })

    await logAdminAction({
      adminId: guard.admin.adminId,
      adminEmail,
      action: 'booking.escalated_to_dispute',
      resourceType: 'booking',
      resourceId: bookingId,
      oldValue: { status: 'COMPLETED_BY_WORKER' },
      newValue: { status: 'DISPUTED', disputeId: result.disputeId },
      notes: reason,
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    return NextResponse.json({ ok: true, disputeId: result.disputeId })
  } catch (err) {
    return bookingErrorResponse(err, '[POST booking escalate]')
  }
}