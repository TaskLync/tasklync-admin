import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { bannerSvc } from '@/lib/services/booking'
import { serviceErrorResponse } from '@/lib/internal-client'
import { zodResponse } from '@/lib/coupons-api'
import { mapBanner, reorderSchema } from '@/lib/banners-api'
import { BANNER_PLACEMENT } from '@/lib/banner-constants'

export const dynamic = 'force-dynamic'

/** Body { ids }: every banner of the placement, in the new order. A stale list is refused (409). */
export async function PATCH(req: NextRequest) {
  const guard = await requirePermission('banners:manage')
  if (!guard.ok) return guard.response
  const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }
  try {
    const { ids } = reorderSchema.parse(await req.json().catch(() => ({})))
    const out = await bannerSvc.reorder(admin, BANNER_PLACEMENT, ids)
    await logAdminAction({
      adminId: admin.id, adminEmail: admin.email, action: 'banner.reordered', resourceType: 'banner_placement',
      resourceId: BANNER_PLACEMENT, newValue: { order: ids },
      ip: getClientIp(req), userAgent: req.headers.get('user-agent') ?? undefined,
    })
    return NextResponse.json({ data: out.items.map(mapBanner) })
  } catch (err) {
    return zodResponse(err) ?? serviceErrorResponse(err, '[PATCH banners reorder]')
  }
}
