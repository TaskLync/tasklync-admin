import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { rankingSvc } from '@/lib/services/search'
import { serviceErrorResponse } from '@/lib/internal-client'
import { mapOverride, overrideSchema } from '@/lib/ranking-api'
import { zodResponse } from '@/lib/coupons-api'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermission('ranking:view')
  if (!guard.ok) return guard.response
  try {
    const rows = (await rankingSvc.overrides()) as unknown[]
    return NextResponse.json({ data: rows.map(mapOverride) })
  } catch (err) {
    return serviceErrorResponse(err, '[GET ranking overrides]')
  }
}

export async function POST(req: NextRequest) {
  const guard = await requirePermission('ranking:config')
  if (!guard.ok) return guard.response
  try {
    const b = overrideSchema.parse(await req.json().catch(() => ({})))
    const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }
    const out = await rankingSvc.upsertOverride(admin, {
      scope_type: b.scopeType, scope_value: b.scopeValue, patch: b.patch, note: b.note,
    })
    await logAdminAction({
      adminId: admin.id, adminEmail: admin.email, action: 'ranking.override_set', resourceType: 'ranking_override',
      resourceId: out.id, newValue: { scope: `${b.scopeType}:${b.scopeValue}`, patch: b.patch },
      ip: getClientIp(req), userAgent: req.headers.get('user-agent') ?? undefined,
    })
    return NextResponse.json({ id: out.id }, { status: 201 })
  } catch (err) {
    return zodResponse(err) ?? serviceErrorResponse(err, '[POST ranking override]')
  }
}