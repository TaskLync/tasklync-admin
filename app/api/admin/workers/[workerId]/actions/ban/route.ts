// app/api/admin/workers/[workerId]/actions/ban/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { isUuid, workerNotFound } from '@/lib/workers-api'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workerId: string }> }
) {
  const guard = await requirePermission('workers:ban') // SUPER_ADMIN only, per rbac.ts
  if (!guard.ok) return guard.response

  const { workerId } = await params
  if (!isUuid(workerId)) return workerNotFound()

  const body = await req.json().catch(() => ({}))
  const reason: string = body.reason?.trim()
  if (!reason) {
    return NextResponse.json({ error: 'A reason is required to ban a worker' }, { status: 400 })
  }

  const { rows } = await db.query(
    `UPDATE workers
     SET banned_at = now(), banned_reason = $2, banned_by = $3,
         is_active = false, is_featured = false, featured_at = NULL,
         updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING banned_at`,
    [workerId, reason, guard.admin.adminId]
  )
  if (rows.length === 0) return workerNotFound()

  await logAdminAction({
    adminId: guard.admin.adminId,
    adminEmail: guard.admin.adminEmail,
    action: 'worker.banned',
    resourceType: 'worker',
    resourceId: workerId,
    newValue: { reason },
    notes: reason,
    ip: getClientIp(req),
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ ok: true })
}