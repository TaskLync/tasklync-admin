import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { rankingSvc } from '@/lib/services/search'
import { serviceErrorResponse } from '@/lib/internal-client'

export const dynamic = 'force-dynamic'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ overrideId: string }> }) {
  const guard = await requirePermission('ranking:config')
  if (!guard.ok) return guard.response
  const { overrideId } = await params // UUID checked by middleware
  try {
    await rankingSvc.removeOverride(overrideId)
    await logAdminAction({
      adminId: guard.admin.adminId, adminEmail: guard.admin.adminEmail, action: 'ranking.override_removed',
      resourceType: 'ranking_override', resourceId: overrideId,
      ip: getClientIp(req), userAgent: req.headers.get('user-agent') ?? undefined,
    })
    return NextResponse.json({ data: { id: overrideId, removed: true } })
  } catch (err) {
    return serviceErrorResponse(err, '[DELETE ranking override]')
  }
}