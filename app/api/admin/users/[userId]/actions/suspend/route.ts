// app/api/admin/users/[userId]/actions/suspend/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'

const DURATIONS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const guard = await requirePermission('users:suspend')
  if (!guard.ok) return guard.response

  const { userId } = await params

  const body = await req.json().catch(() => ({}))
  const reason: string = body.reason?.trim()
  const duration: string = body.duration // '7d' | '30d' | 'custom'
  const customUntil: string | undefined = body.until // ISO date, when duration === 'custom'

  if (!reason) {
    return NextResponse.json({ error: 'A reason is required' }, { status: 400 })
  }

  let until: string
  if (duration === 'custom') {
    if (!customUntil) {
      return NextResponse.json({ error: 'A custom end date is required' }, { status: 400 })
    }
    until = customUntil
  } else if (DURATIONS[duration]) {
    until = `now() + interval '${DURATIONS[duration]} days'`
  } else {
    return NextResponse.json({ error: 'Invalid duration' }, { status: 400 })
  }

  const untilExpr = duration === 'custom' ? '$2::timestamptz' : until

  const { rows } = await db.query(
    `UPDATE users
     SET suspended_until = ${untilExpr},
         suspended_reason = $3,
         suspended_by = $4,
         is_active = false,
         updated_at = now()
     WHERE id = $1
     RETURNING suspended_until`,
    duration === 'custom'
      ? [userId, customUntil, reason, guard.admin.adminId]
      : [userId, null, reason, guard.admin.adminId]
  )

  if (rows.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  await logAdminAction({
    adminId: guard.admin.adminId,
    adminEmail: guard.admin.adminEmail,
    action: 'user.suspended',
    resourceType: 'user',
    resourceId: userId,
    newValue: { suspendedUntil: rows[0].suspended_until, reason },
    notes: reason,
    ip: getClientIp(req),
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ ok: true, suspendedUntil: rows[0].suspended_until })
}