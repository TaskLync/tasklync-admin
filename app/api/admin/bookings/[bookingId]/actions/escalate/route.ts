// app/api/admin/bookings/[bookingId]/actions/escalate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { isUuid } from '@/lib/workers-api'
import { bookingNotFound } from '@/lib/bookings-api'
import { bookingSvc } from '@/lib/services/booking'
import { serviceErrorResponse } from '@/lib/internal-client'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const guard = await requirePermission('bookings:escalate')
  if (!guard.ok) return guard.response

  const { bookingId } = await params
  if (!isUuid(bookingId)) return bookingNotFound()

  const body = await req.json().catch(() => ({}))
  const reason = String(body.reason ?? '').trim()
  if (!reason) return NextResponse.json({ error: 'A reason is required' }, { status: 400 })

  const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }

  try {
    // booking-service only allows COMPLETED_BY_WORKER and answers 409 if a dispute is already open.
    const dispute = await bookingSvc.escalate(bookingId, admin, reason)

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'booking.escalated_to_dispute',
      resourceType: 'booking',
      resourceId: bookingId,
      oldValue: { status: 'COMPLETED_BY_WORKER' },
      newValue: { status: 'DISPUTED', disputeId: dispute.id },
      notes: reason,
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    return NextResponse.json({ ok: true, disputeId: dispute.id })
  } catch (err) {
    return serviceErrorResponse(err, '[POST booking escalate]')
  }
}