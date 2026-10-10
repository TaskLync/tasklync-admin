// app/api/admin/payments/payouts/[payoutId]/retry/route.ts
// Retries a FAILED payout. payment-service resets it to PENDING and re-queues the BullMQ job.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { isUuid } from '@/lib/workers-api'
import { callPaymentService } from '@/lib/payment-service'
import { PaymentActionError, paymentsErrorResponse } from '@/lib/payments-api'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ payoutId: string }> }
) {
  const guard = await requirePermission('payments:payout')
  if (!guard.ok) return guard.response

  const { payoutId } = await params
  if (!isUuid(payoutId)) {
    return NextResponse.json({ error: 'Payout not found' }, { status: 404 })
  }

  try {
    const { rows } = await db.query(
      `SELECT id, status::text AS status, amount, worker_id FROM worker_payouts WHERE id = $1`,
      [payoutId]
    )
    if (rows.length === 0) throw new PaymentActionError(404, 'Payout not found')
    if (rows[0].status !== 'FAILED') {
      throw new PaymentActionError(
        422,
        `Only failed payouts can be retried. This one is ${rows[0].status.toLowerCase()}.`
      )
    }

    const result = await callPaymentService('POST', `/internal/payouts/${payoutId}/retry`, {
      initiated_by: guard.admin.adminId,
    })

    await logAdminAction({
      adminId: guard.admin.adminId,
      adminEmail: guard.admin.adminEmail,
      action: 'payout.retried',
      resourceType: 'payout',
      resourceId: payoutId,
      oldValue: { status: 'FAILED' },
      newValue: { status: 'PENDING', amount: Number(rows[0].amount) },
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    return NextResponse.json({ ok: true, result })
  } catch (err) {
    return paymentsErrorResponse(err, '[POST payout retry]')
  }
}