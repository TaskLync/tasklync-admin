// app/api/admin/bookings/[bookingId]/actions/cancel/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { isUuid } from '@/lib/workers-api'
import { CANCELLABLE_BY_ADMIN, STATUS_LABEL, type BookingStatus } from '@/lib/booking-constants'
import { bookingNotFound } from '@/lib/bookings-api'
import { bookingSvc } from '@/lib/services/booking'
import { serviceErrorResponse } from '@/lib/internal-client'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const guard = await requirePermission('bookings:cancel')
  if (!guard.ok) return guard.response

  const { bookingId } = await params
  if (!isUuid(bookingId)) return bookingNotFound()

  const body = await req.json().catch(() => ({}))
  const reason = String(body.reason ?? '').trim()
  const refundPercent = Number(body.refundPercent) // COD: percent of the platform fee that is waived

  if (!reason) return NextResponse.json({ error: 'A reason is required' }, { status: 400 })
  if (!Number.isFinite(refundPercent) || refundPercent < 0 || refundPercent > 100) {
    return NextResponse.json({ error: 'The percentage must be between 0 and 100' }, { status: 400 })
  }

  const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }

  try {
    const cur = await db.query(`SELECT status::text AS status FROM bookings WHERE id = $1`, [bookingId])
    if (cur.rows.length === 0) return bookingNotFound()
    const status = cur.rows[0].status as BookingStatus
    if (!CANCELLABLE_BY_ADMIN.includes(status)) {
      return NextResponse.json(
        { error: `A booking that is ${STATUS_LABEL[status].toLowerCase()} can't be cancelled.` },
        { status: 422 }
      )
    }

    const result = await bookingSvc.cancel(bookingId, admin, { reason, refundPercent })

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'booking.cancelled_by_admin',
      resourceType: 'booking',
      resourceId: bookingId,
      oldValue: { status },
      newValue: { status: 'CANCELLED', refundPercent, refundAmount: result.refund_amount },
      notes: reason,
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    return NextResponse.json({ ok: true, refundPercent, refundAmount: result.refund_amount })
  } catch (err) {
    return serviceErrorResponse(err, '[POST booking cancel]')
  }
}