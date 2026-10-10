// app/api/admin/bookings/[bookingId]/actions/override-status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { isUuid } from '@/lib/workers-api'
import {
  BOOKING_STATUSES,
  OVERRIDE_TARGETS,
  STATUS_EVENT,
  STATUS_LABEL,
  type BookingStatus,
} from '@/lib/booking-constants'
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
  const guard = await requirePermission('bookings:override')
  if (!guard.ok) return guard.response

  const { bookingId } = await params
  if (!isUuid(bookingId)) return bookingNotFound()

  const body = await req.json().catch(() => ({}))
  const reason: string = String(body.reason ?? '').trim()
  const toStatus = String(body.toStatus ?? '') as BookingStatus

  if (!reason) {
    return NextResponse.json({ error: 'A reason is required' }, { status: 400 })
  }
  if (!(BOOKING_STATUSES as readonly string[]).includes(toStatus)) {
    return NextResponse.json({ error: 'Invalid target status' }, { status: 400 })
  }

  const adminEmail = guard.admin.adminEmail

  try {
    const result = await withTx(async (client) => {
      await setActor(client, adminEmail)
      const b = await lockBooking(client, bookingId)

      const allowed = OVERRIDE_TARGETS[b.status] ?? []
      if (!allowed.includes(toStatus)) {
        throw new BookingActionError(
          422,
          `A ${STATUS_LABEL[b.status].toLowerCase()} booking can't be moved to ${STATUS_LABEL[
            toStatus
          ].toLowerCase()}.`
        )
      }

      const sets = ['status = $2::booking_status', 'updated_at = now()']
      if (toStatus === 'IN_PROGRESS') sets.push('started_at = COALESCE(started_at, now())')
      if (toStatus === 'COMPLETED') {
        sets.push('completed_at = COALESCE(completed_at, now())', 'auto_completed = false')
      }

      await client.query(`UPDATE bookings SET ${sets.join(', ')} WHERE id = $1`, [
        bookingId,
        toStatus,
      ])

      const baseData = { overridden_by_admin: true, reason, previous_status: b.status }

      await enqueueBookingEvent(client, b, {
        eventType: STATUS_EVENT[toStatus] as string,
        status: toStatus,
        adminEmail,
        data: toStatus === 'COMPLETED' ? { ...baseData, auto_completed: false } : baseData,
      })

      if (toStatus === 'COMPLETED') {
        await enqueueBookingEvent(client, b, {
          eventType: 'booking.payment_release',
          status: 'COMPLETED',
          adminEmail,
          data: {
            estimated_total: b.estimatedTotal,
            platform_fee: b.platformFee,
            worker_amount: b.workerAmount,
            currency: b.currency,
            reason,
          },
        })
      }

      return { previousStatus: b.status }
    })

    await logAdminAction({
      adminId: guard.admin.adminId,
      adminEmail,
      action: 'booking.status_overridden',
      resourceType: 'booking',
      resourceId: bookingId,
      oldValue: { status: result.previousStatus },
      newValue: { status: toStatus },
      notes: reason,
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    return NextResponse.json({ ok: true, status: toStatus })
  } catch (err) {
    return bookingErrorResponse(err, '[POST booking override-status]')
  }
}