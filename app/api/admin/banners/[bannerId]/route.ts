import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { bannerSvc } from '@/lib/services/booking'
import { serviceErrorResponse } from '@/lib/internal-client'
import { zodResponse } from '@/lib/coupons-api'
import { auditSnapshot, bannerUpdateSchema, mapBanner, mapStats, toServiceBody } from '@/lib/banners-api'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ bannerId: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const guard = await requirePermission('banners:view')
  if (!guard.ok) return guard.response
  const { bannerId } = await params
  try {
    const r = (await bannerSvc.get(bannerId)) as { stats: unknown }
    return NextResponse.json({ ...mapBanner(r), stats: mapStats(r.stats) })
  } catch (err) {
    return serviceErrorResponse(err, '[GET banner]')
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const guard = await requirePermission('banners:manage')
  if (!guard.ok) return guard.response
  const { bannerId } = await params
  try {
    const body = bannerUpdateSchema.parse(await req.json().catch(() => ({})))
    const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }
    const banner = mapBanner(await bannerSvc.update(bannerId, admin, toServiceBody(body)))
    await logAdminAction({
      adminId: admin.id, adminEmail: admin.email, action: 'banner.updated', resourceType: 'banner',
      resourceId: bannerId, newValue: auditSnapshot(banner),
      notes: `Changed: ${Object.keys(body).filter((k) => k !== 'version').join(', ') || 'nothing'}`,
      ip: getClientIp(req), userAgent: req.headers.get('user-agent') ?? undefined,
    })
    return NextResponse.json({ data: banner })
  } catch (err) {
    return zodResponse(err) ?? serviceErrorResponse(err, '[PATCH banner]')
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const guard = await requirePermission('banners:delete')
  if (!guard.ok) return guard.response
  const { bannerId } = await params
  const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }
  try {
    const out = await bannerSvc.remove(bannerId, admin)
    await logAdminAction({
      adminId: admin.id, adminEmail: admin.email, action: 'banner.deleted', resourceType: 'banner',
      resourceId: bannerId, oldValue: { campaignName: out.campaign_name },
      ip: getClientIp(req), userAgent: req.headers.get('user-agent') ?? undefined,
    })
    return NextResponse.json({ data: { id: bannerId } })
  } catch (err) {
    return serviceErrorResponse(err, '[DELETE banner]')
  }
}
