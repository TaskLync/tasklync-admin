// app/api/admin/workers/[workerId]/actions/approve-verification/route.ts
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
  const guard = await requirePermission('workers:verify')
  if (!guard.ok) return guard.response

  const { workerId } = await params
  if (!isUuid(workerId)) return workerNotFound()

  const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }

  try {
    await workerSvc.verify(workerId, admin)
    void searchSvc.reindexWorker(workerId) // worker.verified also reaches search; this makes it immediate

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'worker.verification_approved',
      resourceType: 'worker',
      resourceId: workerId,
      oldValue: { verificationStatus: 'PENDING_REVIEW' },
      newValue: { verificationStatus: 'VERIFIED' },
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return serviceErrorResponse(err, '[POST approve-verification]')
  }
}