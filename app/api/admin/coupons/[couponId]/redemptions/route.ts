import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { couponSvc } from '@/lib/services/booking'
import { serviceErrorResponse } from '@/lib/internal-client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ couponId: string }> }) {
  const guard = await requirePermission('coupons:view')
  if (!guard.ok) return guard.response
  const { couponId } = await params
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1', 10) || 1)
  try {
    const out = await couponSvc.redemptions(couponId, { page, page_size: 20 }) as { items: any[] }
    return NextResponse.json({
      data: out.items.map((r) => ({
        id: r.id, bookingId: r.booking_id, status: r.status, discountAmount: Number(r.discount_amount),
        subtotalBefore: Number(r.subtotal_before), releaseReason: r.release_reason, createdAt: r.created_at,
        releasedAt: r.released_at, userName: r.user_name, phoneLast4: r.phone_last4, // phone masked to the last 4
      })),
      page,
    })
  } catch (err) {
    return serviceErrorResponse(err, '[GET coupon redemptions]')
  }
}