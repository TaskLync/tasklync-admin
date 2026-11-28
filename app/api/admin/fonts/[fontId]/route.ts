import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { fontSvc } from '@/lib/services/booking'
import { serviceErrorResponse } from '@/lib/internal-client'
import { zodResponse } from '@/lib/coupons-api'
import { fontUpdateSchema, mapFontDetail } from '@/lib/fonts-api'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ fontId: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const guard = await requirePermission('fonts:view')
  if (!guard.ok) return guard.response
  const { fontId } = await params
  try {
    return NextResponse.json({ data: mapFontDetail(await fontSvc.get(fontId)) })
  } catch (err) {
    return serviceErrorResponse(err, '[GET font]')
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const guard = await requirePermission('fonts:manage')
  if (!guard.ok) return guard.response
  const { fontId } = await params
  try {
    const body = fontUpdateSchema.parse(await req.json().catch(() => ({})))
    const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }
    const font = mapFontDetail(await fontSvc.update(fontId, admin, {
      version: body.version, name: body.name, description: body.description === '' ? null : body.description,
    }))
    await logAdminAction({
      adminId: admin.id, adminEmail: admin.email, action: 'font.updated', resourceType: 'font',
      resourceId: fontId, newValue: { name: font.name, description: font.description },
      ip: getClientIp(req), userAgent: req.headers.get('user-agent') ?? undefined,
    })
    return NextResponse.json({ data: font })
  } catch (err) {
    return zodResponse(err) ?? serviceErrorResponse(err, '[PATCH font]')
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const guard = await requirePermission('fonts:manage')
  if (!guard.ok) return guard.response
  const { fontId } = await params
  const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }
  try {
    const out = await fontSvc.remove(fontId, admin)
    await logAdminAction({
      adminId: admin.id, adminEmail: admin.email, action: 'font.deleted', resourceType: 'font',
      resourceId: fontId, oldValue: { name: out.name },
      ip: getClientIp(req), userAgent: req.headers.get('user-agent') ?? undefined,
    })
    return NextResponse.json({ data: { id: fontId } })
  } catch (err) {
    return serviceErrorResponse(err, '[DELETE font]')
  }
}
