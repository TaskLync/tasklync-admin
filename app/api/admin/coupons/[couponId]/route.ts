import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { couponSvc } from '@/lib/services/booking'
import { serviceErrorResponse } from '@/lib/internal-client'
import { mapCoupon } from '@/lib/coupons-api'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ couponId: string }> }) {
  const guard = await requirePermission('coupons:view')
  if (!guard.ok) return guard.response
  const { couponId } = await params
  try {
    const r = await couponSvc.get(couponId) as any
    return NextResponse.json({
      ...mapCoupon(r),
      stats: { consumed: r.stats.consumed, released: r.stats.released, discountPkr: Number(r.stats.discount_pkr) },
      history: r.history.map((h: any) => ({
        fromStatus: h.from_status, toStatus: h.to_status, actorEmail: h.actor_email, note: h.note, createdAt: h.created_at,
      })),
    })
  } catch (err) {
    return serviceErrorResponse(err, '[GET coupon]')
  }
}