import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { rankingSvc } from '@/lib/services/search'
import { serviceErrorResponse } from '@/lib/internal-client'
import { activateSchema, isVersion } from '@/lib/ranking-api'
import { zodResponse } from '@/lib/coupons-api'

export const dynamic = 'force-dynamic'

// Activating an older version is the rollback. Other search pods pick it up within RANKING_CONFIG_CACHE_SECONDS.
export async function POST(req: NextRequest, { params }: { params: Promise<{ version: string }> }) {
  const { version } = await params
  if (!isVersion(version)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const guard = await requirePermission('ranking:config')
  if (!guard.ok) return guard.response
  try {
    const { note } = activateSchema.parse(await req.json().catch(() => ({})))
    const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }
    const out = await rankingSvc.activate(Number(version), admin, note)
    await logAdminAction({
      adminId: admin.id, adminEmail: admin.email, action: 'ranking.config_activated', resourceType: 'ranking_config',
      resourceId: version, newValue: out, notes: note,
      ip: getClientIp(req), userAgent: req.headers.get('user-agent') ?? undefined,
    })
    return NextResponse.json({ data: out })
  } catch (err) {
    return zodResponse(err) ?? serviceErrorResponse(err, '[POST ranking activate]')
  }
}