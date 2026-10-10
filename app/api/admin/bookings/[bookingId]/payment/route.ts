// app/api/admin/bookings/[bookingId]/payment/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { isUuid } from '@/lib/workers-api'
import { bookingNotFound } from '@/lib/bookings-api'

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
    const bookingRes = await db.query(
      `SELECT estimated_total, platform_fee, worker_amount, currency,
              is_payment_confirmed, payment_intent_id, refund_amount, refund_percentage
       FROM bookings WHERE id = $1`,
      [bookingId]
    )
    if (bookingRes.rows.length === 0) return bookingNotFound()
    const b = bookingRes.rows[0]

    let available = true
    let payments: unknown[] = []
    try {
      const payRes = await db.query(
        `SELECT * FROM payments WHERE booking_id = $1 ORDER BY created_at DESC LIMIT 5`,
        [bookingId]
      )
      payments = payRes.rows.map((r) => ({
        id: r.id,
        status: r.status,
        amount: num(r.booking_amount),
        workerAmount: num(r.worker_amount),
        platformFee: num(r.platform_fee),
        providerRef:
          r.payment_intent_id ?? r.stripe_payment_intent_id ?? r.stripe_charge_id ?? null,
        createdAt: r.created_at,
      }))
    } catch (err: any) {
      if (err?.code !== '42P01' && err?.code !== '42703') throw err
      available = false
    }

    return NextResponse.json({
      available,
      estimatedTotal: Number(b.estimated_total),
      platformFee: Number(b.platform_fee),
      workerAmount: Number(b.worker_amount),
      currency: b.currency,
      isPaymentConfirmed: b.is_payment_confirmed,
      paymentIntentId: b.payment_intent_id,
      refundAmount: num(b.refund_amount),
      refundPercentage: num(b.refund_percentage),
      payments,
    })
  } catch (err) {
    console.error('[GET booking payment]', err)
    return NextResponse.json({ error: 'Failed to load payment details' }, { status: 500 })
  }
}