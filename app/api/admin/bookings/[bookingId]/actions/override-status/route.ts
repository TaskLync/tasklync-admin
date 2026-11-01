// app/api/admin/bookings/[bookingId]/actions/override-status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { isUuid } from '@/lib/workers-api'
import {
  BOOKING_STATUSES, OVERRIDE_TARGETS, STATUS_LABEL, type BookingStatus,
} from '@/lib/booking-constants'
import { bookingNotFound } from '@/lib/bookings-api'
import { bookingSvc } from '@/lib/services/booking'
import { serviceErrorResponse } from '@/lib/internal-client'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const guard = await requirePermission('bookings:override')
  if (!guard.ok) return guard.response

  const { bookingId } = await params
  if (!isUuid(bookingId)) return bookingNotFound()

  const body = await req.json().catch(() => ({}))
  const reason = String(body.reason ?? '').trim()
  const toStatus = String(body.toStatus ?? '') as BookingStatus

  if (!reason) return NextResponse.json({ error: 'A reason is required' }, { status: 400 })
  if (!(BOOKING_STATUSES as readonly string[]).includes(toStatus)) {
    return NextResponse.json({ error: 'Invalid target status' }, { status: 400 })
  }

  const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }

  try {
    const cur = await db.query(`SELECT status::text AS status FROM bookings WHERE id = $1`, [bookingId])
    if (cur.rows.length === 0) return bookingNotFound()
    const from = cur.rows[0].status as BookingStatus

    const allowed = OVERRIDE_TARGETS[from] ?? []
    if (!allowed.includes(toStatus)) {
      return NextResponse.json(
        {
          error: `A ${STATUS_LABEL[from].toLowerCase()} booking can't be moved to ${STATUS_LABEL[toStatus].toLowerCase()}.`,
        },
        { status: 422 }
      )
    }

    // booking-service runs the real transition: COD settlement, BullMQ jobs, is_on_job, events.
    await bookingSvc.overrideStatus(bookingId, admin, { toStatus, reason })

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'booking.status_overridden',
      resourceType: 'booking',
      resourceId: bookingId,
      oldValue: { status: from },
      newValue: { status: toStatus },
      notes: reason,
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    return NextResponse.json({ ok: true, status: toStatus })
  } catch (err) {
    return serviceErrorResponse(err, '[POST booking override-status]')
  }
}