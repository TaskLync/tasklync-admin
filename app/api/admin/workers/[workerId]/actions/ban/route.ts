// app/api/admin/workers/[workerId]/actions/ban/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
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
  const guard = await requirePermission('workers:ban') // SUPER_ADMIN only
  if (!guard.ok) return guard.response

  const { workerId } = await params
  if (!isUuid(workerId)) return workerNotFound()

  const body = await req.json().catch(() => ({}))
  const reason: string = body.reason?.trim()
  if (!reason) return NextResponse.json({ error: 'A reason is required to ban a worker' }, { status: 400 })

  const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }

  try {
    // Writes the columns, clears worker/chat/contact caches, emits worker.moderation_changed (search drops the worker in seconds).
    await workerSvc.moderate(workerId, admin, { action: 'ban', reason })

    // Admin-owned columns
    await db.query(`UPDATE workers SET is_featured = false, featured_at = NULL WHERE id = $1`, [workerId])
    void searchSvc.reindexWorker(workerId)

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'worker.banned',
      resourceType: 'worker',
      resourceId: workerId,
      newValue: { reason },
      notes: reason,
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return serviceErrorResponse(err, '[POST worker ban]')
  }
}