import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { bannerSvc } from '@/lib/services/booking'
import { serviceErrorResponse } from '@/lib/internal-client'
import { zodResponse } from '@/lib/coupons-api'
import { mapPlacement, placementSchema } from '@/lib/banners-api'
import { BANNER_PLACEMENT } from '@/lib/banner-constants'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ code: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const guard = await requirePermission('banners:view')
  if (!guard.ok) return guard.response
  const { code } = await params
  if (code !== BANNER_PLACEMENT) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  try {
    return NextResponse.json(mapPlacement(await bannerSvc.placement(code)))
  } catch (err) {
    return serviceErrorResponse(err, '[GET banner placement]')
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const guard = await requirePermission('banners:manage')
  if (!guard.ok) return guard.response
  const { code } = await params
  if (code !== BANNER_PLACEMENT) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }
  try {
    const b = placementSchema.parse(await req.json().catch(() => ({})))
    const out = mapPlacement(await bannerSvc.updatePlacement(code, admin, {
      auto_slide_enabled: b.autoSlideEnabled, auto_slide_interval_ms: b.autoSlideIntervalMs, max_banners: b.maxBanners,
    }))
    await logAdminAction({
      adminId: admin.id, adminEmail: admin.email, action: 'banner.placement_updated', resourceType: 'banner_placement',
      resourceId: code, newValue: b,
      ip: getClientIp(req), userAgent: req.headers.get('user-agent') ?? undefined,
    })
    return NextResponse.json({ data: out })
  } catch (err) {
    return zodResponse(err) ?? serviceErrorResponse(err, '[PUT banner placement]')
  }
}
