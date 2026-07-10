// app/api/admin/users/[userId]/actions/ban/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction } from '@/lib/audit'

export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const guard = await requirePermission('users:ban') // SUPER_ADMIN only, per rbac.ts
  if (!guard.ok) return guard.response

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
    [params.userId, reason, guard.admin.id]
  )
  if (rows.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  await logAdminAction({
    adminId: guard.admin.id,
    adminEmail: guard.admin.email,
    action: 'user.banned',
    resourceType: 'user',
    resourceId: params.userId,
    newValue: { reason },
    notes: reason,
    req,
  })

  return NextResponse.json({ ok: true })
}