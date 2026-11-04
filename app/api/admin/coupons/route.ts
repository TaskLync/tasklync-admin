import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { couponSvc } from '@/lib/services/booking'
import { serviceErrorResponse } from '@/lib/internal-client'
import { couponCreateSchema, mapCoupon, toServiceBody, zodResponse } from '@/lib/coupons-api'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requirePermission('coupons:view')
  if (!guard.ok) return guard.response
  const sp = req.nextUrl.searchParams
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '20', 10) || 20))
  try {
    const out = await couponSvc.list({
      status: sp.get('status') || undefined, search: sp.get('search') || undefined, page, page_size: pageSize,
    })
    return NextResponse.json({
      data: out.items.map(mapCoupon), page, pageSize, total: out.total,
      totalPages: Math.max(1, Math.ceil(out.total / pageSize)),
    })
  } catch (err) {
    return serviceErrorResponse(err, '[GET coupons]')
  }
}

export async function POST(req: NextRequest) {
  const guard = await requirePermission('coupons:create')
  if (!guard.ok) return guard.response
  try {
    const body = couponCreateSchema.parse(await req.json().catch(() => ({})))
    const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }
    const row = await couponSvc.create(admin, toServiceBody(body)) as any
    await logAdminAction({
      adminId: admin.id, adminEmail: admin.email, action: 'coupon.created', resourceType: 'coupon',
      resourceId: row.id, newValue: { code: row.code_display, type: body.discountType, value: body.discountValue, status: row.status },
      ip: getClientIp(req), userAgent: req.headers.get('user-agent') ?? undefined,
    })
    return NextResponse.json({ data: mapCoupon(row) }, { status: 201 })
  } catch (err) {
    return zodResponse(err) ?? serviceErrorResponse(err, '[POST coupons]')
  }
}