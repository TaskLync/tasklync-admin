import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { bannerSvc } from '@/lib/services/booking'
import { serviceErrorResponse } from '@/lib/internal-client'
import { zodResponse } from '@/lib/coupons-api'
import { auditSnapshot, mapBanner, statusSchema, versionSchema } from '@/lib/banners-api'

export const dynamic = 'force-dynamic'

/**
 * Lifecycle actions, all under banners:publish (they change what customers see).
 *   publish | unpublish        body { version }
 *   status (activate/deactivate) body { version, isEnabled }
 */
const ACTIONS = ['publish', 'unpublish', 'status'] as const
type Action = (typeof ACTIONS)[number]

export async function POST(req: NextRequest, { params }: { params: Promise<{ bannerId: string; action: string }> }) {
  const { bannerId, action } = await params
  if (!(ACTIONS as readonly string[]).includes(action)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const guard = await requirePermission('banners:publish')
  if (!guard.ok) return guard.response
  const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }

  try {
    const raw = await req.json().catch(() => ({}))
    let row: unknown
    let audit: string
    if ((action as Action) === 'status') {
      const b = statusSchema.parse(raw)
      row = await bannerSvc.setEnabled(bannerId, admin, b.version, b.isEnabled)
      audit = b.isEnabled ? 'banner.activated' : 'banner.deactivated'
    } else {
      const b = versionSchema.parse(raw)
      row = action === 'publish'
        ? await bannerSvc.publish(bannerId, admin, b.version)
        : await bannerSvc.unpublish(bannerId, admin, b.version)
      audit = action === 'publish' ? 'banner.published' : 'banner.unpublished'
    }
    const banner = mapBanner(row)
    await logAdminAction({
      adminId: admin.id, adminEmail: admin.email, action: audit, resourceType: 'banner',
      resourceId: bannerId, newValue: auditSnapshot(banner),
      ip: getClientIp(req), userAgent: req.headers.get('user-agent') ?? undefined,
    })
    return NextResponse.json({ data: banner })
  } catch (err) {
    return zodResponse(err) ?? serviceErrorResponse(err, `[POST banner ${action}]`)
  }
}
