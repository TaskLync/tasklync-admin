// app/api/admin/payments/refunds/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { isUuid } from '@/lib/workers-api'
import { callPaymentService } from '@/lib/payment-service'
import { REFUNDABLE_STATUSES } from '@/lib/payment-constants'
import {
  PaymentActionError,
  REFUND_COLUMNS_SQL,
  REFUND_FROM_SQL,
  buildRefundWhere,
  mapRefundRow,
  num,
  pagedResponse,
  parsePaging,
  paymentsErrorResponse,
} from '@/lib/payments-api'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requirePermission('payments:view')
  if (!guard.ok) return guard.response

  const sp = req.nextUrl.searchParams
  const { whereSql, params } = buildRefundWhere(sp)
  const { page, pageSize, offset } = parsePaging(sp)

  try {
    const [listRes, countRes] = await Promise.all([
      db.query(
        `SELECT ${REFUND_COLUMNS_SQL}
         ${REFUND_FROM_SQL}
         ${whereSql}
         ORDER BY r.initiated_at DESC, r.id
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, pageSize, offset]
      ),
      db.query(`SELECT count(*)::int AS total ${REFUND_FROM_SQL} ${whereSql}`, params),
    ])
    return NextResponse.json(
      pagedResponse(listRes.rows.map(mapRefundRow), countRes.rows[0].total, page, pageSize)
    )
  } catch (err) {
    return paymentsErrorResponse(err, '[GET /api/admin/payments/refunds]')
  }
}

// Manual refund (ADMIN_MANUAL_REFUND). payment-service owns the actual refund record,
// BullMQ job and gateway call. We only validate and forward.
export async function POST(req: NextRequest) {
  const guard = await requirePermission('payments:refund')
  if (!guard.ok) return guard.response

  const body = await req.json().catch(() => ({}))
  const paymentId = String(body.paymentId ?? '')
  const reason = String(body.reason ?? '').trim()
  const amount = Math.round(Number(body.amount) * 100) / 100

  if (!isUuid(paymentId)) {
    return NextResponse.json({ error: 'Invalid payment' }, { status: 400 })
  }
  if (!reason) {
    return NextResponse.json({ error: 'A reason is required' }, { status: 400 })
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Enter a refund amount above zero' }, { status: 400 })
  }

  try {
    const { rows } = await db.query(
      `SELECT p.id, p.booking_id, p.status::text AS status, p.booking_amount,
              COALESCE((SELECT sum(r.amount) FROM refunds r
                         WHERE r.payment_id = p.id AND r.status::text <> 'FAILED'), 0) AS refunded
       FROM payments p WHERE p.id = $1`,
      [paymentId]
    )
    if (rows.length === 0) throw new PaymentActionError(404, 'Payment not found')

    const p = rows[0]
    if (!REFUNDABLE_STATUSES.includes(p.status)) {
      throw new PaymentActionError(
        422,
        `A payment that is ${p.status.toLowerCase().replace(/_/g, ' ')} can't be refunded.`
      )
    }

    const remaining = Math.round((num(p.booking_amount) - num(p.refunded)) * 100) / 100
    if (amount > remaining) {
      throw new PaymentActionError(
        422,
        `You can refund at most PKR ${remaining.toLocaleString()} on this payment.`
      )
    }

    const result = await callPaymentService('POST', '/internal/refunds', {
      payment_id: paymentId,
      amount,
      reason: 'ADMIN_MANUAL_REFUND',
      note: reason,
      initiated_by: guard.admin.adminId,
    })

    await logAdminAction({
      adminId: guard.admin.adminId,
      adminEmail: guard.admin.adminEmail,
      action: 'payment.manual_refund',
      resourceType: 'payment',
      resourceId: paymentId,
      oldValue: { status: p.status, refunded: num(p.refunded) },
      newValue: { amount, bookingId: p.booking_id },
      notes: reason,
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    return NextResponse.json({ ok: true, refund: result }, { status: 201 })
  } catch (err) {
    return paymentsErrorResponse(err, '[POST payments refund]')
  }
}