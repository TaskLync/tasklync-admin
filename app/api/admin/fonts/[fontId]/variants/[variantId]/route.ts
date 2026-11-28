import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { fontSvc } from '@/lib/services/booking'
import { serviceErrorResponse } from '@/lib/internal-client'
import { mapFontDetail } from '@/lib/fonts-api'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ fontId: string; variantId: string }> }

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const guard = await requirePermission('fonts:manage')
  if (!guard.ok) return guard.response
  const { fontId, variantId } = await params
  const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }
  try {
    const font = mapFontDetail(await fontSvc.removeVariant(fontId, variantId, admin))
    await logAdminAction({
      adminId: admin.id, adminEmail: admin.email, action: 'font.file_removed', resourceType: 'font',
      resourceId: fontId, oldValue: { variantId },
      ip: getClientIp(req), userAgent: req.headers.get('user-agent') ?? undefined,
    })
    return NextResponse.json({ data: font })
  } catch (err) {
    return serviceErrorResponse(err, '[DELETE font variant]')
  }
}
