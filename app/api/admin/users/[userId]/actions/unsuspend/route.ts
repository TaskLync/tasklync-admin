
// app/api/admin/users/[userId]/actions/unsuspend/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const guard = await requirePermission('users:suspend')
  if (!guard.ok) return guard.response

  const { userId } = await params

  const { rows } = await db.query(
    `UPDATE users
     SET suspended_until = NULL, suspended_reason = NULL, is_active = true, updated_at = now()
     WHERE id = $1
     RETURNING id`,
    [userId]
  )

  if (rows.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  await logAdminAction({
    adminId: guard.admin.adminId,
    adminEmail: guard.admin.adminEmail,
    action: 'user.unsuspended',
    resourceType: 'user',
    resourceId: userId,
    ip: getClientIp(req),
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ ok: true })
}
