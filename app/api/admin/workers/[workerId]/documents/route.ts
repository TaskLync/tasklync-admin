// app/api/admin/workers/[workerId]/documents/route.ts
// Gated by workers:verify. URLs are signed by worker-service and expire after ~15 minutes.
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { isUuid, workerNotFound } from '@/lib/workers-api'
import { workerSvc, mapSignedDocuments } from '@/lib/services/worker'
import { serviceErrorResponse } from '@/lib/internal-client'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workerId: string }> }
) {
  const guard = await requirePermission('workers:verify')
  if (!guard.ok) return guard.response

  const { workerId } = await params
  if (!isUuid(workerId)) return workerNotFound()

  try {
    const summary = await workerSvc.verificationSummary(workerId)
    const docs = mapSignedDocuments(summary)

    // Every access to identity documents is logged.
    await logAdminAction({
      adminId: guard.admin.adminId,
      adminEmail: guard.admin.adminEmail,
      action: 'worker.documents_viewed',
      resourceType: 'worker',
      resourceId: workerId,
      notes: `${docs.length} document(s)`,
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    return NextResponse.json(docs)
  } catch (err) {
    return serviceErrorResponse(err, '[GET worker documents]')
  }
}