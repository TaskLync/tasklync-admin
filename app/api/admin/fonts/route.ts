import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { fontSvc } from '@/lib/services/booking'
import { serviceErrorResponse } from '@/lib/internal-client'
import { zodResponse } from '@/lib/coupons-api'
import { fontCreateSchema, mapFont } from '@/lib/fonts-api'

export const dynamic = 'force-dynamic'

/** ?active=true lists only active families: what the banner editor's font pickers offer. */
export async function GET(req: NextRequest) {
  const activeOnly = req.nextUrl.searchParams.get('active') === 'true'
  // The banner editor needs the active list; the library page needs everything.
  const guard = await requirePermission(activeOnly ? 'banners:view' : 'fonts:view')
  if (!guard.ok) return guard.response
  try {
    const out = await fontSvc.list(activeOnly)
    return NextResponse.json({ data: out.items.map(mapFont) })
  } catch (err) {
    return serviceErrorResponse(err, '[GET fonts]')
  }
}

export async function POST(req: NextRequest) {
  const guard = await requirePermission('fonts:manage')
  if (!guard.ok) return guard.response
  try {
    const body = fontCreateSchema.parse(await req.json().catch(() => ({})))
    const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }
    const font = mapFont(await fontSvc.create(admin, { name: body.name, description: body.description || null }))
    await logAdminAction({
      adminId: admin.id, adminEmail: admin.email, action: 'font.created', resourceType: 'font',
      resourceId: font.id, newValue: { name: font.name },
      ip: getClientIp(req), userAgent: req.headers.get('user-agent') ?? undefined,
    })
    return NextResponse.json({ data: font }, { status: 201 })
  } catch (err) {
    return zodResponse(err) ?? serviceErrorResponse(err, '[POST fonts]')
  }
}
