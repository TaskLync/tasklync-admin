// app/api/admin/users/[userId]/actions/warn/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction } from '@/lib/audit'

export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const guard = await requirePermission('users:warn')
  if (!guard.ok) return guard.response

  const body = await req.json().catch(() => ({}))
  const reason: string = body.reason?.trim()
  if (!reason) {
    return NextResponse.json({ error: 'A reason is required' }, { status: 400 })
  }

  const { rows: before } = await db.query(
    `SELECT warning_count FROM users WHERE id = $1`,
    [params.userId]
  )
  if (before.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { rows } = await db.query(
    `UPDATE users
     SET warning_count = warning_count + 1,
         last_warning_at = now(),
         last_warning_reason = $2,
         updated_at = now()
     WHERE id = $1
     RETURNING warning_count, last_warning_at`,
    [params.userId, reason]
  )

  await logAdminAction({
    adminId: guard.admin.id,
    adminEmail: guard.admin.email,
    action: 'user.warned',
    resourceType: 'user',
    resourceId: params.userId,
    oldValue: { warningCount: before[0].warning_count },
    newValue: { warningCount: rows[0].warning_count, reason },
    notes: reason,
    req,
  })

  return NextResponse.json({ ok: true, warningCount: rows[0].warning_count })
}