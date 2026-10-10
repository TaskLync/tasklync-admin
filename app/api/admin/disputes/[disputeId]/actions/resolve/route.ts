// app/api/admin/disputes/[disputeId]/actions/resolve/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { isUuid } from '@/lib/workers-api'
import {
  DISPUTE_RESOLUTIONS,
  NOTE_MAX_LENGTH,
  RESPONSE_WINDOW_HOURS,
  bookingStatusForResolution,
  isActiveDispute,
  refundPercentage,
  roundMoney,
  type DisputeResolution,
} from '@/lib/dispute-constants'
import {
  DisputeActionError,
  disputeErrorResponse,
  disputeNotFound,
  enqueueBookingEvent,
  enqueueNotification,
  lockBooking,
  setActor,
  withTx,
} from '@/lib/disputes-api'

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
  if (!note) {
    return NextResponse.json({ error: 'A resolution note is required' }, { status: 400 })
  }
  if (note.length > NOTE_MAX_LENGTH) {
    return NextResponse.json({ error: 'Note is too long (max 1000 characters)' }, { status: 400 })
  }
  if (resolution === 'PARTIAL_REFUND') {
    const a = Number(body.refundAmount)
    if (!Number.isFinite(a) || a <= 0) {
      return NextResponse.json({ error: 'Enter a refund amount above zero' }, { status: 400 })
    }
  }

  const adminId = guard.admin.adminId
  const adminEmail = guard.admin.adminEmail
  const isSuper = guard.admin.role === 'SUPER_ADMIN'

  try {
    const result = await withTx(async (client) => {
      await setActor(client, adminEmail) // booking history shows "admin:<email>"

      // Lock order: booking -> dispute (matches booking-service, avoids deadlocks).
      const pre = await client.query('SELECT booking_id FROM disputes WHERE id = $1', [disputeId])
      if (pre.rows.length === 0) throw new DisputeActionError(404, 'Dispute not found')
      const b = await lockBooking(client, pre.rows[0].booking_id)

      const { rows } = await client.query(
        `SELECT status::text AS status, worker_response, is_escalated, created_at
         FROM disputes WHERE id = $1 FOR UPDATE`,
        [disputeId]
      )
      const d = rows[0]

      if (!isActiveDispute(d.status)) {
        throw new DisputeActionError(409, 'This dispute was already resolved.')
      }
      if (d.is_escalated && !isSuper) {
        throw new DisputeActionError(
          403,
          'This dispute was escalated. Only a Super Admin can resolve it.'
        )
      }
      if (b.status !== 'DISPUTED') {
        throw new DisputeActionError(
          422,
          `The booking is ${b.status.toLowerCase().replace(/_/g, ' ')}, not disputed, so this dispute can't be resolved from here.`
        )
      }

      // Worker still has time to answer? Require an explicit override (logged).
      const dueAt = new Date(d.created_at).getTime() + RESPONSE_WINDOW_HOURS * 3_600_000
      const waitingOnWorker =
        d.status === 'OPEN' && !d.worker_response && Date.now() < dueAt
      if (waitingOnWorker && !overrideWindow) {
        throw new DisputeActionError(
          409,
          `The worker still has until ${new Date(dueAt).toLocaleString('en-GB')} to respond. Tick "resolve without waiting" to decide now.`
        )
      }

      // The server decides the money, never the browser.
      let refundAmount: number
      if (resolution === 'REFUND_GRANTED') {
        refundAmount = b.estimatedTotal
      } else if (resolution === 'NO_REFUND') {
        refundAmount = 0
      } else {
        refundAmount = roundMoney(Number(body.refundAmount))
        if (refundAmount <= 0 || refundAmount >= b.estimatedTotal) {
          throw new DisputeActionError(
            400,
            `A partial refund must be above 0 and below the booking total (${b.currency} ${b.estimatedTotal.toLocaleString()}). Use "Resolve for customer — 100%" for a full refund.`
          )
        }
      }
      const pct = refundPercentage(b.estimatedTotal, refundAmount)
      const newBookingStatus = bookingStatusForResolution(resolution)

      await client.query(
        `UPDATE disputes
         SET status = 'RESOLVED',
             resolution = $2::dispute_resolution,
             admin_note = $3,
             refund_amount = $4,
             resolved_by = $5,
             resolved_at = now(),
             assigned_to = COALESCE(assigned_to, $5),
             assigned_at = COALESCE(assigned_at, now()),
             updated_at = now()
         WHERE id = $1`,
        [disputeId, resolution, note, refundAmount, adminId]
      )

      await client.query(
        `UPDATE bookings
         SET status = $2::booking_status,
             refund_amount = $3,
             refund_percentage = $4,
             updated_at = now()
         WHERE id = $1`,
        [b.id, newBookingStatus, refundAmount, pct]
      )

      // payment-service consumes this and refunds / releases (payment doc, section 13).
      await enqueueBookingEvent(client, b, {
        eventType: 'booking.dispute_resolved',
        status: newBookingStatus,
        adminEmail,
        data: {
          dispute_id: disputeId,
          resolution,
          refund_amount: refundAmount,
          refund_percentage: pct,
          estimated_total: b.estimatedTotal,
          platform_fee: b.platformFee,
          worker_amount: b.workerAmount,
          currency: b.currency,
          admin_note: note,
          resolved_by_admin: true,
        },
      })

      for (const target of [
        { id: b.userId, type: 'user' as const },
        { id: b.workerId, type: 'worker' as const },
      ]) {
        await enqueueNotification(client, {
          targetId: target.id,
          targetType: target.type,
          templateKey: 'dispute_resolved',
          data: {
            booking_id: b.id,
            dispute_id: disputeId,
            resolution,
            refund_amount: refundAmount,
            currency: b.currency,
          },
          channels: ['push'],
        })
      }

      return {
        previousStatus: d.status as string,
        refundAmount,
        pct,
        bookingStatus: newBookingStatus,
        overrode: waitingOnWorker && overrideWindow,
      }
    })

    await logAdminAction({
      adminId,
      adminEmail,
      action: 'dispute.resolved',
      resourceType: 'dispute',
      resourceId: disputeId,
      oldValue: { status: result.previousStatus, bookingStatus: 'DISPUTED' },
      newValue: {
        status: 'RESOLVED',
        resolution,
        refundAmount: result.refundAmount,
        refundPercentage: result.pct,
        bookingStatus: result.bookingStatus,
        resolvedWithoutWaitingForWorker: result.overrode,
      },
      notes: note,
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    return NextResponse.json({
      ok: true,
      resolution,
      refundAmount: result.refundAmount,
      refundPercentage: result.pct,
      bookingStatus: result.bookingStatus,
    })
  } catch (err) {
    return disputeErrorResponse(err, '[POST dispute resolve]')
  }
}