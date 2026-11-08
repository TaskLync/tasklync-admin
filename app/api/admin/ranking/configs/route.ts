import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { rankingSvc } from '@/lib/services/search'
import { serviceErrorResponse } from '@/lib/internal-client'
import { createConfigSchema, mapConfig } from '@/lib/ranking-api'
import { zodResponse } from '@/lib/coupons-api'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermission('ranking:view')
  if (!guard.ok) return guard.response
  try {
    const rows = (await rankingSvc.configs()) as unknown[]
    return NextResponse.json({ data: rows.map(mapConfig) })
  } catch (err) {
    return serviceErrorResponse(err, '[GET ranking configs]')
  }
}

export async function POST(req: NextRequest) {
  const guard = await requirePermission('ranking:config')
  if (!guard.ok) return guard.response
  try {
    const b = createConfigSchema.parse(await req.json().catch(() => ({})))
    const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }
    const out = await rankingSvc.createConfig(admin, {
      weights: b.weights, params: b.params, prior_mean: b.priorMean, prior_weight: b.priorWeight, note: b.note,
    })
    await logAdminAction({
      adminId: admin.id, adminEmail: admin.email, action: 'ranking.config_created', resourceType: 'ranking_config',
      resourceId: String(out.version), newValue: { weights: b.weights, params: b.params, note: b.note },
      ip: getClientIp(req), userAgent: req.headers.get('user-agent') ?? undefined,
    })
    return NextResponse.json({ version: out.version }, { status: 201 })
  } catch (err) {
    return zodResponse(err) ?? serviceErrorResponse(err, '[POST ranking config]')
  }
}