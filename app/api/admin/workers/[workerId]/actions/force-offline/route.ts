// app/api/admin/workers/[workerId]/actions/force-offline/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { isUuid, workerNotFound } from '@/lib/workers-api'
import { workerSvc } from '@/lib/services/worker'
import { searchSvc } from '@/lib/services/search'
import { serviceErrorResponse } from '@/lib/internal-client'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workerId: string }> }
) {
  const guard = await requirePermission('workers:force-offline')
  if (!guard.ok) return guard.response

  const { workerId } = await params
  if (!isUuid(workerId)) return workerNotFound()

  const body = await req.json().catch(() => ({}))
  const reason: string = body.reason?.trim()
  if (!reason) return NextResponse.json({ error: 'A reason is required' }, { status: 400 })

  const minutes = Math.min(1440, Math.max(5, Number(process.env.FORCE_OFFLINE_MINUTES) || 60))
  const until = new Date(Date.now() + minutes * 60_000)
  const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }

  try {
    await workerSvc.moderate(workerId, admin, {
      action: 'suspend',
      reason: `Forced offline: ${reason}`,
      until: until.toISOString(),
    })
    void searchSvc.reindexWorker(workerId)

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'worker.forced_offline',
      resourceType: 'worker',
      resourceId: workerId,
      newValue: { until: until.toISOString(), minutes, reason },
      notes: reason,
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })
    return NextResponse.json({ ok: true, until: until.toISOString() })
  } catch (err) {
    return serviceErrorResponse(err, '[POST worker force-offline]')
  }
}