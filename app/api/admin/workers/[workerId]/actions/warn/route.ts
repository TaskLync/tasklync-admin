// app/api/admin/workers/[workerId]/actions/warn/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { isUuid, workerNotFound } from '@/lib/workers-api'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workerId: string }> }
) {
  const guard = await requirePermission('workers:warn')
  if (!guard.ok) return guard.response

  const { workerId } = await params
  if (!isUuid(workerId)) return workerNotFound()

  const body = await req.json().catch(() => ({}))
  const reason: string = body.reason?.trim()
  if (!reason) {
    return NextResponse.json({ error: 'A reason is required' }, { status: 400 })
  }

  const { rows: before } = await db.query(
    `SELECT warning_count FROM workers WHERE id = $1 AND deleted_at IS NULL`,
    [workerId]
  )
  if (before.length === 0) return workerNotFound()

  const { rows } = await db.query(
    `UPDATE workers
     SET warning_count = warning_count + 1,
         last_warning_at = now(),
         last_warning_reason = $2,
         updated_at = now()
     WHERE id = $1
     RETURNING warning_count`,
    [workerId, reason]
  )

  await logAdminAction({
    adminId: guard.admin.adminId,
    adminEmail: guard.admin.adminEmail,
    action: 'worker.warned',
    resourceType: 'worker',
    resourceId: workerId,
    oldValue: { warningCount: before[0].warning_count },
    newValue: { warningCount: rows[0].warning_count, reason },
    notes: reason,
    ip: getClientIp(req),
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ ok: true, warningCount: rows[0].warning_count })
}