import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { bannerSvc } from '@/lib/services/booking'
import { serviceErrorResponse } from '@/lib/internal-client'
import { zodResponse } from '@/lib/coupons-api'
import { auditSnapshot, bannerCreateSchema, mapBanner, toServiceBody } from '@/lib/banners-api'
import { BANNER_PLACEMENT, BANNER_STATES } from '@/lib/banner-constants'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requirePermission('banners:view')
  if (!guard.ok) return guard.response
  const sp = req.nextUrl.searchParams
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '50', 10) || 50))
  const state = sp.get('state')
  try {
    const out = await bannerSvc.list({
      placement: BANNER_PLACEMENT,
      state: state && (BANNER_STATES as readonly string[]).includes(state) ? state : undefined,
      search: sp.get('search')?.trim().slice(0, 60) || undefined,
      page, page_size: pageSize,
    })
    return NextResponse.json({
      data: out.items.map(mapBanner), page, pageSize, total: out.total,
      totalPages: Math.max(1, Math.ceil(out.total / pageSize)),
    })
  } catch (err) {
    return serviceErrorResponse(err, '[GET banners]')
  }
}

export async function POST(req: NextRequest) {
  const guard = await requirePermission('banners:manage')
  if (!guard.ok) return guard.response
  try {
    const body = bannerCreateSchema.parse(await req.json().catch(() => ({})))
    const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }
    const banner = mapBanner(await bannerSvc.create(admin, toServiceBody(body)))
    await logAdminAction({
      adminId: admin.id, adminEmail: admin.email, action: 'banner.created', resourceType: 'banner',
      resourceId: banner.id, newValue: auditSnapshot(banner),
      ip: getClientIp(req), userAgent: req.headers.get('user-agent') ?? undefined,
    })
    return NextResponse.json({ data: banner }, { status: 201 })
  } catch (err) {
    return zodResponse(err) ?? serviceErrorResponse(err, '[POST banners]')
  }
}
