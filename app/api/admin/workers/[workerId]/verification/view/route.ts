// app/api/admin/workers/[workerId]/verification/view/route.ts
// "Who viewed this profile and when". Called once per page open; the same
// admin viewing again within 10 minutes is not logged twice.
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

  try {
    const recent = await db.query(
      `SELECT 1 FROM admin_audit_log
       WHERE admin_id = $1 AND resource_id = $2
         AND action = 'worker.verification_viewed'
         AND created_at > now() - interval '10 minutes'
       LIMIT 1`,
      [guard.admin.adminId, workerId]
    )

    if (recent.rows.length === 0) {
      await logAdminAction({
        adminId: guard.admin.adminId,
        adminEmail: guard.admin.adminEmail,
        action: 'worker.verification_viewed',
        resourceType: 'worker',
        resourceId: workerId,
        ip: getClientIp(req),
        userAgent: req.headers.get('user-agent') ?? undefined,
      })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST worker verification view]', err)
    return NextResponse.json({ error: 'Failed to log view' }, { status: 500 })
  }
}