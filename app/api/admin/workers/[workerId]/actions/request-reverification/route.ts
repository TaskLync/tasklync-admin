// app/api/admin/workers/[workerId]/actions/request-reverification/route.ts
// Moves a VERIFIED worker back to UNVERIFIED so they can re-upload documents.
// worker-service's nearby query requires VERIFIED, so they leave search results.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { isUuid, workerNotFound } from '@/lib/workers-api'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workerId: string }> }
) {
  const guard = await requirePermission('workers:verify')
  if (!guard.ok) return guard.response

  const { workerId } = await params
  if (!isUuid(workerId)) return workerNotFound()

  const body = await req.json().catch(() => ({}))
  const reason: string = body.reason?.trim()
  if (!reason) {
    return NextResponse.json({ error: 'A reason is required' }, { status: 400 })
  }

  const { rows } = await db.query(
    `UPDATE workers
     SET verification_status = 'UNVERIFIED',
         reverification_requested_at = now(),
         reverification_reason = $2,
         is_featured = false,
         featured_at = NULL,
         updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL AND verification_status = 'VERIFIED'
     RETURNING id`,
    [workerId, reason]
  )

  if (rows.length === 0) {
    return NextResponse.json(
      { error: 'Worker not found, or not currently verified' },
      { status: 409 }
    )
  }

  await logAdminAction({
    adminId: guard.admin.adminId,
    adminEmail: guard.admin.adminEmail,
    action: 'worker.reverification_requested',
    resourceType: 'worker',
    resourceId: workerId,
    oldValue: { verificationStatus: 'VERIFIED' },
    newValue: { verificationStatus: 'UNVERIFIED', reason },
    notes: reason,
    ip: getClientIp(req),
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ ok: true })
}