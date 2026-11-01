// app/api/admin/disputes/[disputeId]/actions/resolve/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { isUuid } from '@/lib/workers-api'
import {
  DISPUTE_RESOLUTIONS, NOTE_MAX_LENGTH, RESPONSE_WINDOW_HOURS, isActiveDispute,
  refundPercentage, roundMoney, type DisputeResolution,
} from '@/lib/dispute-constants'
import { disputeNotFound } from '@/lib/disputes-api'
import { bookingSvc } from '@/lib/services/booking'
import { serviceErrorResponse } from '@/lib/internal-client'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ disputeId: string }> }
) {
  const guard = await requirePermission('disputes:resolve')
  if (!guard.ok) return guard.response

  const { disputeId } = await params
  if (!isUuid(disputeId)) return disputeNotFound()

  const body = await req.json().catch(() => ({}))
  const resolution = String(body.resolution ?? '') as DisputeResolution
  const note = String(body.note ?? '').trim()
  const overrideWindow = body.overrideWindow === true

  if (!(DISPUTE_RESOLUTIONS as readonly string[]).includes(resolution)) {
    return NextResponse.json({ error: 'Invalid resolution' }, { status: 400 })
  }
  if (!note) return NextResponse.json({ error: 'A resolution note is required' }, { status: 400 })
  if (note.length > NOTE_MAX_LENGTH) {
    return NextResponse.json({ error: 'Note is too long (max 1000 characters)' }, { status: 400 })
  }
  let refundAmount: number | undefined
  if (resolution === 'PARTIAL_REFUND') {
    refundAmount = roundMoney(Number(body.refundAmount))
    if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
      return NextResponse.json({ error: 'Enter an amount above zero' }, { status: 400 })
    }
  }

  const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }
  const isSuper = guard.admin.role === 'SUPER_ADMIN'

  try {
    const { rows } = await db.query(
      `SELECT d.status::text AS status, d.worker_response, d.is_escalated, d.created_at,
              b.status::text AS booking_status, b.estimated_total, b.currency
         FROM disputes d JOIN bookings b ON b.id = d.booking_id
        WHERE d.id = $1`,
      [disputeId]
    )
    if (rows.length === 0) return disputeNotFound()
    const d = rows[0]

    if (!isActiveDispute(d.status)) {
      return NextResponse.json({ error: 'This dispute was already resolved.' }, { status: 409 })
    }
    if (d.is_escalated && !isSuper) {
      return NextResponse.json(
        { error: 'This dispute was escalated. Only a Super Admin can resolve it.' },
        { status: 403 }
      )
    }
    if (d.booking_status !== 'DISPUTED') {
      return NextResponse.json(
        { error: `The booking is ${String(d.booking_status).toLowerCase().replace(/_/g, ' ')}, not disputed.` },
        { status: 422 }
      )
    }

    const dueAt = new Date(d.created_at).getTime() + RESPONSE_WINDOW_HOURS * 3_600_000
    const waitingOnWorker = d.status === 'OPEN' && !d.worker_response && Date.now() < dueAt
    if (waitingOnWorker && !overrideWindow) {
      return NextResponse.json(
        {
          error: `The worker still has until ${new Date(dueAt).toLocaleString('en-GB')} to respond. Tick "resolve without waiting" to decide now.`,
        },
        { status: 409 }
      )
    }

    const total = Number(d.estimated_total)
    if (resolution === 'PARTIAL_REFUND' && refundAmount !== undefined && refundAmount >= total) {
      return NextResponse.json(
        { error: `A partial amount must be below the booking total (${d.currency} ${total.toLocaleString()}).` },
        { status: 400 }
      )
    }
    const finalAmount = resolution === 'REFUND_GRANTED' ? total : resolution === 'NO_REFUND' ? 0 : (refundAmount as number)

    // Authoritative step: status, money fields, events and notifications happen in booking-service.
    await bookingSvc.resolveDispute(disputeId, admin, { resolution, note, refundAmount })

    // Admin-owned columns (best effort: the dispute is already resolved).
    await db
      .query(
        `UPDATE disputes SET assigned_to = COALESCE(assigned_to, $2), assigned_at = COALESCE(assigned_at, now())
          WHERE id = $1`,
        [disputeId, admin.id]
      )
      .catch((e) => console.warn('[dispute resolve] assignment update failed', e))

    const pct = refundPercentage(total, finalAmount)
    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'dispute.resolved',
      resourceType: 'dispute',
      resourceId: disputeId,
      oldValue: { status: d.status, bookingStatus: 'DISPUTED' },
      newValue: {
        status: 'RESOLVED',
        resolution,
        refundAmount: finalAmount,
        refundPercentage: pct,
        bookingStatus: finalAmount > 0 ? 'REFUNDED' : 'RESOLVED',
        resolvedWithoutWaitingForWorker: waitingOnWorker && overrideWindow,
      },
      notes: note,
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    return NextResponse.json({
      ok: true,
      resolution,
      refundAmount: finalAmount,
      refundPercentage: pct,
      bookingStatus: finalAmount > 0 ? 'REFUNDED' : 'RESOLVED',
    })
  } catch (err) {
    return serviceErrorResponse(err, '[POST dispute resolve]')
  }
}