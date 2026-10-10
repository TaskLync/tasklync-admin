// app/api/admin/bookings/[bookingId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { isUuid, PRESENCE_SQL, STATUS_SQL } from '@/lib/workers-api'
import { CITY_SQL, FROM_SQL, PAYMENT_STATUS_SQL, bookingNotFound } from '@/lib/bookings-api'
import type { BookingDetail } from '@/types/booking'

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const guard = await requirePermission('bookings:view')
  if (!guard.ok) return guard.response

  const { bookingId } = await params
  if (!isUuid(bookingId)) return bookingNotFound()

  try {
    const { rows } = await db.query(
      `SELECT
         b.id, b.status::text AS status, b.category_id, c.name AS category_name,
         b.service_id, s.name AS service_name, b.service_type::text AS service_type,
         b.scheduled_at, b.duration_hours, b.expires_at, b.started_at, b.completed_at,
         b.created_at, b.updated_at, b.address_text,
         ST_Y(b.job_site_location::geometry) AS lat,
         ST_X(b.job_site_location::geometry) AS lng,
         b.base_price, b.price_type, b.urgency_multiplier, b.demand_multiplier,
         b.time_of_day_multiplier, b.estimated_total, b.platform_fee, b.worker_amount,
         b.currency, b.refund_amount, b.refund_percentage,
         b.is_urgent, b.is_payment_confirmed, b.payment_intent_id, b.auto_completed,
         b.description, b.worker_note, b.cancellation_reason, b.cancelled_by,
         ${PAYMENT_STATUS_SQL} AS payment_status,
         ${CITY_SQL} AS city,
         u.id AS user_id, u.name AS user_name, u.phone AS user_phone, u.email AS user_email,
         u.avatar_url AS user_avatar, u.total_bookings AS user_total_bookings,
         fn_user_status(u.is_active, u.deleted_at, u.banned_at, u.suspended_until) AS user_status,
         w.id AS worker_id, w.name AS worker_name, w.phone AS worker_phone,
         w.avatar_url AS worker_avatar, w.avg_rating, w.total_reviews, w.city AS worker_city,
         lower(w.verification_status::text) AS worker_verification,
         ${STATUS_SQL}   AS worker_status,
         ${PRESENCE_SQL} AS worker_presence,
         (SELECT row_to_json(d) FROM (
            SELECT id, status::text AS status, resolution::text AS resolution,
                   reason, refund_amount, created_at
            FROM disputes WHERE booking_id = b.id
            ORDER BY created_at DESC LIMIT 1
         ) d) AS dispute
       ${FROM_SQL}
       LEFT JOIN services s ON s.id = b.service_id
       WHERE b.id = $1`,
      [bookingId]
    )
    if (rows.length === 0) return bookingNotFound()

    const r = rows[0]
    const d = r.dispute

    const detail: BookingDetail = {
      id: r.id,
      status: r.status,
      categoryId: r.category_id,
      categoryName: r.category_name,
      serviceId: r.service_id,
      serviceName: r.service_name,
      serviceType: r.service_type,
      scheduledAt: r.scheduled_at,
      durationHours: Number(r.duration_hours),
      expiresAt: r.expires_at,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      city: r.city,
      addressText: r.address_text,
      lat: num(r.lat),
      lng: num(r.lng),
      pricing: {
        basePrice: Number(r.base_price),
        priceType: r.price_type,
        urgencyMultiplier: Number(r.urgency_multiplier),
        demandMultiplier: Number(r.demand_multiplier),
        timeOfDayMultiplier: Number(r.time_of_day_multiplier),
        estimatedTotal: Number(r.estimated_total),
        platformFee: Number(r.platform_fee),
        workerAmount: Number(r.worker_amount),
        currency: r.currency,
        refundAmount: num(r.refund_amount),
        refundPercentage: num(r.refund_percentage),
      },
      isUrgent: r.is_urgent,
      isPaymentConfirmed: r.is_payment_confirmed,
      paymentIntentId: r.payment_intent_id,
      autoCompleted: r.auto_completed,
      paymentStatus: r.payment_status,
      description: r.description,
      workerNote: r.worker_note,
      cancellationReason: r.cancellation_reason,
      cancelledBy: r.cancelled_by,
      user: {
        id: r.user_id,
        name: r.user_name,
        phone: r.user_phone,
        email: r.user_email,
        avatarUrl: r.user_avatar,
        status: r.user_status,
        totalBookings: r.user_total_bookings ?? 0,
      },
      worker: {
        id: r.worker_id,
        name: r.worker_name,
        phone: r.worker_phone,
        avatarUrl: r.worker_avatar,
        avgRating: Number(r.avg_rating ?? 0),
        totalReviews: r.total_reviews ?? 0,
        city: r.worker_city,
        verificationStatus: r.worker_verification,
        status: r.worker_status,
        presence: r.worker_presence,
      },
      dispute: d
        ? {
            id: d.id,
            status: d.status,
            resolution: d.resolution,
            reason: d.reason,
            refundAmount: num(d.refund_amount),
            createdAt: d.created_at,
          }
        : null,
    }

    return NextResponse.json(detail)
  } catch (err) {
    console.error('[GET /api/admin/bookings/[bookingId]]', err)
    return NextResponse.json({ error: 'Failed to load booking' }, { status: 500 })
  }
}