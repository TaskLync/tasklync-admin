// app/api/admin/workers/[workerId]/actions/unsuspend/route.ts
// Lifts a suspension only; a banned worker stays banned (worker-service enforces it).
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
  const guard = await requirePermission('workers:suspend')
  if (!guard.ok) return guard.response

  const { workerId } = await params
  if (!isUuid(workerId)) return workerNotFound()

  const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }

  try {
    await workerSvc.moderate(workerId, admin, { action: 'unsuspend', reason: 'Suspension lifted by admin' })
    void searchSvc.reindexWorker(workerId)

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'worker.unsuspended',
      resourceType: 'worker',
      resourceId: workerId,
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return serviceErrorResponse(err, '[POST worker unsuspend]')
  }
}