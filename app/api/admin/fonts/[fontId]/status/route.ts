import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { fontSvc } from '@/lib/services/booking'
import { serviceErrorResponse } from '@/lib/internal-client'
import { zodResponse } from '@/lib/coupons-api'
import { fontStatusSchema, mapFontDetail } from '@/lib/fonts-api'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ fontId: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const guard = await requirePermission('fonts:manage')
  if (!guard.ok) return guard.response
  const { fontId } = await params
  try {
    const body = fontStatusSchema.parse(await req.json().catch(() => ({})))
    const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }
    const font = mapFontDetail(await fontSvc.setActive(fontId, admin, body.version, body.isActive))
    await logAdminAction({
      adminId: admin.id, adminEmail: admin.email, action: body.isActive ? 'font.activated' : 'font.deactivated',
      resourceType: 'font', resourceId: fontId, newValue: { name: font.name, isActive: font.isActive },
      ip: getClientIp(req), userAgent: req.headers.get('user-agent') ?? undefined,
    })
    return NextResponse.json({ data: font })
  } catch (err) {
    return zodResponse(err) ?? serviceErrorResponse(err, '[PATCH font status]')
  }
}
