// app/api/admin/workers/[workerId]/actions/reject-verification/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { isUuid, workerNotFound } from '@/lib/workers-api'
import { REJECTION_CODES } from '@/lib/verification-constants'
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

  const body = await req.json().catch(() => ({}))
  const reasonCode = String(body.reasonCode ?? '')
  const note = String(body.note ?? '').trim()
  const allowResubmission = body.allowResubmission !== false

  if (!REJECTION_CODES.includes(reasonCode)) {
    return NextResponse.json({ error: 'Pick a rejection reason' }, { status: 400 })
  }
  if (!note) return NextResponse.json({ error: 'A note for the worker is required' }, { status: 400 })
  if (note.length > 1000) {
    return NextResponse.json({ error: 'Note is too long (max 1000 characters)' }, { status: 400 })
  }

  const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }

  try {
    await workerSvc.reject(workerId, admin, { reasonCode, note, allowResubmission })
    void searchSvc.reindexWorker(workerId)

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'worker.verification_rejected',
      resourceType: 'worker',
      resourceId: workerId,
      oldValue: { verificationStatus: 'PENDING_REVIEW' },
      newValue: { verificationStatus: 'REJECTED', reasonCode, allowResubmission, note },
      notes: note,
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return serviceErrorResponse(err, '[POST reject-verification]')
  }
}