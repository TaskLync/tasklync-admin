import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { rankingSvc } from '@/lib/services/search'
import { serviceErrorResponse } from '@/lib/internal-client'
import { isVersion, shadowSchema } from '@/lib/ranking-api'
import { zodResponse } from '@/lib/coupons-api'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ version: string }> }) {
  const { version } = await params
  if (!isVersion(version)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const guard = await requirePermission('ranking:config')
  if (!guard.ok) return guard.response
  try {
    const b = shadowSchema.parse(await req.json().catch(() => ({})))
    const out = await rankingSvc.shadow(Number(version), b.enabled, b.samplePct)
    await logAdminAction({
      adminId: guard.admin.adminId, adminEmail: guard.admin.adminEmail, action: 'ranking.shadow_changed',
      resourceType: 'ranking_config', resourceId: version, newValue: out,
      ip: getClientIp(req), userAgent: req.headers.get('user-agent') ?? undefined,
    })
    return NextResponse.json({ data: out })
  } catch (err) {
    return zodResponse(err) ?? serviceErrorResponse(err, '[POST ranking shadow]')
  }
}