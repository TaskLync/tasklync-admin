// app/api/admin/users/[userId]/actions/ban/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const guard = await requirePermission('users:ban') // SUPER_ADMIN only, per rbac.ts
  if (!guard.ok) return guard.response

  const { userId } = await params

  const body = await req.json().catch(() => ({}))
  const reason: string = body.reason?.trim()
  if (!reason) {
    return NextResponse.json({ error: 'A reason is required to ban a user' }, { status: 400 })
  }

  const { rows } = await db.query(
    `UPDATE users
     SET banned_at = now(), banned_reason = $2, banned_by = $3, is_active = false, updated_at = now()
     WHERE id = $1
     RETURNING banned_at`,
    [userId, reason, guard.admin.adminId]
  )
  if (rows.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  await logAdminAction({
    adminId: guard.admin.adminId,
    adminEmail: guard.admin.adminEmail,
    action: 'user.banned',
    resourceType: 'user',
    resourceId: userId,
    newValue: { reason },
    notes: reason,
    ip: getClientIp(req),
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ ok: true })
}