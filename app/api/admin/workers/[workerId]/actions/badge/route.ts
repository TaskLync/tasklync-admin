// app/api/admin/workers/[workerId]/actions/badge/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { isUuid, workerNotFound } from '@/lib/workers-api'

const BADGES = ['top_rated', 'background_verified']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workerId: string }> }
) {
  const guard = await requirePermission('workers:badge')
  if (!guard.ok) return guard.response

  const { workerId } = await params
  if (!isUuid(workerId)) return workerNotFound()

  const body = await req.json().catch(() => ({}))
  const badge: string = body.badge
  const action: string = body.action // 'add' | 'remove'

  if (!BADGES.includes(badge)) {
    return NextResponse.json({ error: 'Unknown badge' }, { status: 400 })
  }
  if (action !== 'add' && action !== 'remove') {
    return NextResponse.json({ error: 'Action must be "add" or "remove"' }, { status: 400 })
  }

  try {
    if (action === 'add') {
      await db.query(
        `INSERT INTO worker_badges (worker_id, badge, awarded_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (worker_id, badge) DO NOTHING`,
        [workerId, badge, guard.admin.adminId]
      )
    } else {
      await db.query(`DELETE FROM worker_badges WHERE worker_id = $1 AND badge = $2`, [
        workerId,
        badge,
      ])
    }
  } catch (err: any) {
    if (err?.code === '23503') return workerNotFound() // foreign key: no such worker
    throw err
  }

  await logAdminAction({
    adminId: guard.admin.adminId,
    adminEmail: guard.admin.adminEmail,
    action: action === 'add' ? 'worker.badge_awarded' : 'worker.badge_removed',
    resourceType: 'worker',
    resourceId: workerId,
    newValue: { badge },
    ip: getClientIp(req),
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ ok: true })
}