// app/api/admin/workers/[workerId]/actions/feature/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { isUuid, workerNotFound } from '@/lib/workers-api'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workerId: string }> }
) {
  const guard = await requirePermission('workers:feature')
  if (!guard.ok) return guard.response

  const { workerId } = await params
  if (!isUuid(workerId)) return workerNotFound()

  const body = await req.json().catch(() => ({}))
  if (typeof body.featured !== 'boolean') {
    return NextResponse.json({ error: '"featured" must be true or false' }, { status: 400 })
  }
  const featured: boolean = body.featured

  // Only verified, non-banned workers can be featured. Un-featuring always works.
  const { rows } = await db.query(
    `UPDATE workers
     SET is_featured = $2,
         featured_at = CASE WHEN $2::boolean THEN now() ELSE NULL END,
         updated_at = now()
     WHERE id = $1
       AND deleted_at IS NULL
       AND ($2::boolean = false OR (verification_status = 'VERIFIED' AND banned_at IS NULL))
     RETURNING is_featured`,
    [workerId, featured]
  )

  if (rows.length === 0) {
    return NextResponse.json(
      { error: 'Worker not found, or not eligible to be featured (must be verified and not banned)' },
      { status: 409 }
    )
  }

  await logAdminAction({
    adminId: guard.admin.adminId,
    adminEmail: guard.admin.adminEmail,
    action: featured ? 'worker.featured' : 'worker.unfeatured',
    resourceType: 'worker',
    resourceId: workerId,
    newValue: { isFeatured: featured },
    ip: getClientIp(req),
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ ok: true, isFeatured: featured })
}