import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { couponSvc } from '@/lib/services/booking'
import { serviceErrorResponse } from '@/lib/internal-client'
import { couponBatchSchema, toServiceBody, zodResponse } from '@/lib/coupons-api'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const guard = await requirePermission('coupons:create')
  if (!guard.ok) return guard.response
  try {
    const body = couponBatchSchema.parse(await req.json().catch(() => ({})))
    const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }
    const out = await couponSvc.batch(admin, toServiceBody(body))
    // The codes are returned once to the browser. Only the count and batch id are audited, never the codes.
    await logAdminAction({
      adminId: admin.id, adminEmail: admin.email, action: 'coupon.batch_generated', resourceType: 'coupon_batch',
      resourceId: out.batch_id, newValue: { count: out.count, type: body.discountType, value: body.discountValue },
      ip: getClientIp(req), userAgent: req.headers.get('user-agent') ?? undefined,
    })
    return NextResponse.json({ batchId: out.batch_id, count: out.count, codes: out.codes }, { status: 201 })
  } catch (err) {
    return zodResponse(err) ?? serviceErrorResponse(err, '[POST coupons/batch]')
  }
}