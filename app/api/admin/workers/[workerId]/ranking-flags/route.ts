import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { workerSvc } from '@/lib/services/worker'
import { serviceErrorResponse } from '@/lib/internal-client'
import { flagSchema } from '@/lib/ranking-api'
import { zodResponse } from '@/lib/coupons-api'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ workerId: string }> }) {
  const guard = await requirePermission('ranking:flag')
  if (!guard.ok) return guard.response
  const { workerId } = await params
  try {
    const b = flagSchema.parse(await req.json().catch(() => ({})))
    const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }
    const payload =
      b.action === 'add'
        ? { action: 'add', flag_type: b.flagType, multiplier: b.multiplier, reason: b.reason, expires_at: b.expiresAt }
        : { action: 'revoke', flag_id: b.flagId, reason: b.reason }
    const out = await workerSvc.rankingFlag(workerId, admin, payload)
    await logAdminAction({
      adminId: admin.id, adminEmail: admin.email,
      action: b.action === 'add' ? 'ranking.worker_flagged' : 'ranking.flag_revoked',
      resourceType: 'worker', resourceId: workerId,
      newValue: b.action === 'add' ? { flagType: b.flagType, multiplier: b.multiplier, expiresAt: b.expiresAt } : { flagId: b.flagId },
      notes: b.reason, ip: getClientIp(req), userAgent: req.headers.get('user-agent') ?? undefined,
    })
    return NextResponse.json({ data: out }, { status: b.action === 'add' ? 201 : 200 })
  } catch (err) {
    return zodResponse(err) ?? serviceErrorResponse(err, '[POST worker ranking flag]')
  }
}