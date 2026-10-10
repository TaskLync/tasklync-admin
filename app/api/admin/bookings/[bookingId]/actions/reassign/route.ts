// app/api/admin/bookings/[bookingId]/actions/reassign/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { isUuid, STATUS_SQL } from '@/lib/workers-api'
import { BOOKING_TIMEOUT_MINUTES, REASSIGNABLE, STATUS_LABEL } from '@/lib/booking-constants'
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
  const guard = await requirePermission('bookings:reassign')
  if (!guard.ok) return guard.response

  const { bookingId } = await params
  if (!isUuid(bookingId)) return bookingNotFound()

  const body = await req.json().catch(() => ({}))
  const reason: string = String(body.reason ?? '').trim()
  const newWorkerId: string = String(body.newWorkerId ?? '')

  if (!reason) {
    return NextResponse.json({ error: 'A reason is required' }, { status: 400 })
  }
  if (!isUuid(newWorkerId)) {
    return NextResponse.json({ error: 'Pick a worker to reassign to' }, { status: 400 })
  }

  const adminEmail = guard.admin.adminEmail

  try {
    const result = await withTx(async (client) => {
      await setActor(client, adminEmail)
      const old = await lockBooking(client, bookingId)

      if (!REASSIGNABLE.includes(old.status)) {
        throw new BookingActionError(
          422,
          `A ${STATUS_LABEL[old.status].toLowerCase()} booking can't be reassigned.`
        )
      }
      if (old.workerId === newWorkerId) {
        throw new BookingActionError(400, 'Pick a different worker.')
      }

      // New worker must be verified, active and offer this booking's category.
      const wRes = await client.query(
        `SELECT w.id,
                ${STATUS_SQL} AS status,
                lower(w.verification_status::text) AS verification,
                EXISTS (
                  SELECT 1 FROM worker_skills ws
                  WHERE ws.worker_id = w.id
                    AND ws.category_id = (SELECT category_id FROM bookings WHERE id = $2)
                ) AS has_skill
         FROM workers w
         WHERE w.id = $1`,
        [newWorkerId, bookingId]
      )
      const nw = wRes.rows[0]
      if (!nw) throw new BookingActionError(404, 'Worker not found.')
      if (nw.status !== 'active' || nw.verification !== 'verified') {
        throw new BookingActionError(422, 'That worker is not verified and active.')
      }
      if (!nw.has_skill) {
        throw new BookingActionError(422, "That worker doesn't offer this category.")
      }

      // New PENDING booking: same snapshot, new worker, fresh 30 min expiry.
      const ins = await client.query(
        `INSERT INTO bookings (
           user_id, worker_id, category_id, service_id, service_type, status,
           scheduled_at, duration_hours, expires_at,
           address_id, address_text, job_site_location,
           base_price, urgency_multiplier, demand_multiplier, time_of_day_multiplier,
           estimated_total, platform_fee, worker_amount, currency, price_type,
           is_urgent, is_payment_confirmed, payment_intent_id, description
         )
         SELECT
           user_id, $2::uuid, category_id, service_id, service_type, 'PENDING'::booking_status,
           scheduled_at, duration_hours, now() + interval '${BOOKING_TIMEOUT_MINUTES} minutes',
           address_id, address_text, job_site_location,
           base_price, urgency_multiplier, demand_multiplier, time_of_day_multiplier,
           estimated_total, platform_fee, worker_amount, currency, price_type,
           is_urgent, is_payment_confirmed, payment_intent_id, description
         FROM bookings
         WHERE id = $1
         RETURNING id`,
        [bookingId, newWorkerId]
      )
      const newBookingId: string = ins.rows[0].id

      // Old booking: cancelled, no penalty, no refund (the payment moves with the new booking).
      await client.query(
        `UPDATE bookings
         SET status = 'CANCELLED',
             cancelled_by = 'admin',
             cancellation_reason = $2,
             refund_amount = 0,
             refund_percentage = 0,
             updated_at = now()
         WHERE id = $1`,
        [bookingId, `Reassigned by admin: ${reason}`]
      )

      await enqueueBookingEvent(
        client,
        { id: newBookingId, userId: old.userId, workerId: newWorkerId },
        {
          eventType: 'booking.created',
          status: 'PENDING',
          adminEmail,
          data: { reassigned_from_booking_id: bookingId, reason },
        }
      )
      await enqueueBookingEvent(client, old, {
        eventType: 'booking.cancelled',
        status: 'CANCELLED',
        adminEmail,
        data: {
          cancelled_by: 'admin',
          reason: `Reassigned: ${reason}`,
          refund_percentage: 0,
          refund_amount: 0,
          reassigned: true,
          reassigned_to_booking_id: newBookingId,
          reassigned_to_worker_id: newWorkerId,
          previous_status: old.status,
        },
      })

      await enqueueNotification(client, {
        targetId: newWorkerId,
        targetType: 'worker',
        templateKey: 'booking_request_received',
        data: { booking_id: newBookingId },
        channels: ['push', 'sms'],
      })
      await enqueueNotification(client, {
        targetId: old.userId,
        targetType: 'user',
        templateKey: 'booking_reassigned',
        data: { booking_id: newBookingId },
      })
      await enqueueNotification(client, {
        targetId: old.workerId,
        targetType: 'worker',
        templateKey: 'booking_cancelled_by_admin',
        data: { booking_id: bookingId },
      })

      return { newBookingId, oldWorkerId: old.workerId, oldStatus: old.status }
    })

    await logAdminAction({
      adminId: guard.admin.adminId,
      adminEmail,
      action: 'booking.reassigned',
      resourceType: 'booking',
      resourceId: bookingId,
      oldValue: { workerId: result.oldWorkerId, status: result.oldStatus },
      newValue: { workerId: newWorkerId, newBookingId: result.newBookingId },
      notes: reason,
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    return NextResponse.json({ ok: true, newBookingId: result.newBookingId })
  } catch (err) {
    return bookingErrorResponse(err, '[POST booking reassign]')
  }
}