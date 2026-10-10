// app/api/admin/bookings/[bookingId]/actions/cancel/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { isUuid } from '@/lib/workers-api'
import { CANCELLABLE_BY_ADMIN, STATUS_LABEL } from '@/lib/booking-constants'
import {
  BookingActionError,
  bookingErrorResponse,
  bookingNotFound,
  enqueueBookingEvent,
  enqueueNotification,
  lockBooking,
  setActor,
  withTx,
} from '@/lib/bookings-api'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const guard = await requirePermission('bookings:cancel')
  if (!guard.ok) return guard.response

  const { bookingId } = await params
  if (!isUuid(bookingId)) return bookingNotFound()

  const body = await req.json().catch(() => ({}))
  const reason: string = String(body.reason ?? '').trim()
  const refundPercent = Number(body.refundPercent)

  if (!reason) {
    return NextResponse.json({ error: 'A reason is required' }, { status: 400 })
  }
  if (!Number.isFinite(refundPercent) || refundPercent < 0 || refundPercent > 100) {
    return NextResponse.json({ error: 'Refund must be between 0 and 100 percent' }, { status: 400 })
  }

  const adminEmail = guard.admin.adminEmail

  try {
    const result = await withTx(async (client) => {
      await setActor(client, adminEmail)
      const b = await lockBooking(client, bookingId)

      if (!CANCELLABLE_BY_ADMIN.includes(b.status)) {
        throw new BookingActionError(
          422,
          `A booking that is ${STATUS_LABEL[b.status].toLowerCase()} can't be cancelled.`
        )
      }

      // total * pct / 100, rounded to 2 decimals
      const refundAmount = Math.round(b.estimatedTotal * refundPercent) / 100

      await client.query(
        `UPDATE bookings
         SET status = 'CANCELLED',
             cancelled_by = 'admin',
             cancellation_reason = $2,
             refund_amount = $3,
             refund_percentage = $4,
             updated_at = now()
         WHERE id = $1`,
        [bookingId, reason, refundAmount, refundPercent]
      )

      await enqueueBookingEvent(client, b, {
        eventType: 'booking.cancelled',
        status: 'CANCELLED',
        adminEmail,
        data: {
          cancelled_by: 'admin',
          reason,
          refund_percentage: refundPercent,
          refund_amount: refundAmount,
          previous_status: b.status,
        },
      })

      for (const target of [
        { id: b.userId, type: 'user' as const },
        { id: b.workerId, type: 'worker' as const },
      ]) {
        await enqueueNotification(client, {
          targetId: target.id,
          targetType: target.type,
          templateKey: 'booking_cancelled_by_admin',
          data: { booking_id: bookingId, refund_percentage: refundPercent },
          channels: ['push', 'sms'],
        })
      }

      return { previousStatus: b.status, refundAmount }
    })

    await logAdminAction({
      adminId: guard.admin.adminId,
      adminEmail,
      action: 'booking.cancelled_by_admin',
      resourceType: 'booking',
      resourceId: bookingId,
      oldValue: { status: result.previousStatus },
      newValue: { status: 'CANCELLED', refundPercent, refundAmount: result.refundAmount },
      notes: reason,
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    return NextResponse.json({ ok: true, refundPercent, refundAmount: result.refundAmount })
  } catch (err) {
    return bookingErrorResponse(err, '[POST booking cancel]')
  }
}