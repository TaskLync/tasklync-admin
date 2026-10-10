// app/api/admin/workers/[workerId]/actions/unsuspend/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { isUuid, workerNotFound } from '@/lib/workers-api'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workerId: string }> }
) {
  const guard = await requirePermission('workers:suspend')
  if (!guard.ok) return guard.response

  const { workerId } = await params
  if (!isUuid(workerId)) return workerNotFound()

  // Only lifts a suspension; a banned worker stays banned.
  const { rows } = await db.query(
    `UPDATE workers
     SET suspended_until = NULL, suspended_reason = NULL, suspended_by = NULL,
         is_active = true, updated_at = now()
     WHERE id = $1
       AND deleted_at IS NULL
       AND banned_at IS NULL
       AND suspended_until IS NOT NULL
     RETURNING id`,
    [workerId]
  )

  if (rows.length === 0) {
    return NextResponse.json(
      { error: 'Worker not found, banned, or not currently suspended' },
      { status: 409 }
    )
  }

  await logAdminAction({
    adminId: guard.admin.adminId,
    adminEmail: guard.admin.adminEmail,
    action: 'worker.unsuspended',
    resourceType: 'worker',
    resourceId: workerId,
    ip: getClientIp(req),
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ ok: true })
}