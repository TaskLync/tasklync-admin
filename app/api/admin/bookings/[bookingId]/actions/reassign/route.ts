// app/api/admin/bookings/[bookingId]/actions/reassign/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { isUuid } from '@/lib/workers-api'
import { REASSIGNABLE, STATUS_LABEL, type BookingStatus } from '@/lib/booking-constants'
import { bookingNotFound } from '@/lib/bookings-api'
import { bookingSvc } from '@/lib/services/booking'
import { serviceErrorResponse } from '@/lib/internal-client'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const guard = await requirePermission('bookings:reassign')
  if (!guard.ok) return guard.response

  const { bookingId } = await params
  if (!isUuid(bookingId)) return bookingNotFound()

  const body = await req.json().catch(() => ({}))
  const reason = String(body.reason ?? '').trim()
  const newWorkerId = String(body.newWorkerId ?? '')

  if (!reason) return NextResponse.json({ error: 'A reason is required' }, { status: 400 })
  if (!isUuid(newWorkerId)) return NextResponse.json({ error: 'Pick a worker to reassign to' }, { status: 400 })

  const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }

  try {
    const cur = await db.query(
      `SELECT status::text AS status, worker_id FROM bookings WHERE id = $1`,
      [bookingId]
    )
    if (cur.rows.length === 0) return bookingNotFound()
    const status = cur.rows[0].status as BookingStatus
    if (!REASSIGNABLE.includes(status)) {
      return NextResponse.json(
        { error: `A ${STATUS_LABEL[status].toLowerCase()} booking can't be reassigned.` },
        { status: 422 }
      )
    }

    await bookingSvc.reassign(bookingId, admin, { newWorkerId, reason })

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'booking.reassigned',
      resourceType: 'booking',
      resourceId: bookingId,
      oldValue: { workerId: cur.rows[0].worker_id, status },
      newValue: { workerId: newWorkerId, status: 'PENDING' },
      notes: reason,
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    return NextResponse.json({ ok: true, newBookingId: bookingId })
  } catch (err) {
    return serviceErrorResponse(err, '[POST booking reassign]')
  }
}