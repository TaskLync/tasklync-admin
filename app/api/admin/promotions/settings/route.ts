import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { promotionSvc } from '@/lib/services/booking'
import { serviceErrorResponse } from '@/lib/internal-client'
import { mapSettings, promotionSettingsSchema, toServiceSettings } from '@/lib/promotions-api'
import { zodResponse } from '@/lib/coupons-api'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermission('promotions:view')
  if (!guard.ok) return guard.response
  try {
    return NextResponse.json(mapSettings(await promotionSvc.settings()))
  } catch (err) {
    return serviceErrorResponse(err, '[GET promotion settings]')
  }
}

export async function PUT(req: NextRequest) {
  const guard = await requirePermission('settings:promotions') // SUPER_ADMIN only
  if (!guard.ok) return guard.response
  try {
    const body = promotionSettingsSchema.parse(await req.json().catch(() => ({}))) as Record<string, number>
    const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }
    const before = await promotionSvc.settings().then(mapSettings).catch(() => null)
    const saved = mapSettings(await promotionSvc.updateSettings(admin, toServiceSettings(body)))
    await logAdminAction({
      adminId: admin.id, adminEmail: admin.email, action: 'promotion_settings.updated',
      resourceType: 'platform_config', resourceId: 'promotions',
      oldValue: before ?? undefined, newValue: saved,
      notes: 'booking-service caches these for about 60 seconds',
      ip: getClientIp(req), userAgent: req.headers.get('user-agent') ?? undefined,
    })
    return NextResponse.json(saved)
  } catch (err) {
    return zodResponse(err) ?? serviceErrorResponse(err, '[PUT promotion settings]')
  }
}