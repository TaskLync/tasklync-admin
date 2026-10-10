// app/api/admin/workers/[workerId]/actions/force-offline/route.ts
// Back-dates last_seen_at AND sets manually_paused. Back-dating alone would be undone
// by the app's next 60-second heartbeat.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { isUuid, workerNotFound } from '@/lib/workers-api'

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
  if (!reason) {
    return NextResponse.json({ error: 'A reason is required' }, { status: 400 })
  }

  const { rows } = await db.query(
    `UPDATE workers
     SET manually_paused = true,
         last_seen_at = now() - interval '1 hour',
         updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id`,
    [workerId]
  )
  if (rows.length === 0) return workerNotFound()

  await logAdminAction({
    adminId: guard.admin.adminId,
    adminEmail: guard.admin.adminEmail,
    action: 'worker.forced_offline',
    resourceType: 'worker',
    resourceId: workerId,
    newValue: { manuallyPaused: true, reason },
    notes: reason,
    ip: getClientIp(req),
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ ok: true })
}