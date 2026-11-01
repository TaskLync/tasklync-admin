// app/api/admin/admins/[adminId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { destroyAllSessions } from '@/lib/auth/session'
import { revokeAllTrustedDevices } from '@/lib/auth/trusted-device'

const ROLES = ['SUPER_ADMIN', 'OPS', 'FINANCE', 'SUPPORT']
const MAX_SUPER_ADMINS = 2

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ adminId: string }> }
) {
  const guard = await requirePermission('admin_users:manage')
  if (!guard.ok) return guard.response

  const { adminId } = await params
  if (adminId === guard.admin.adminId) {
    return NextResponse.json({ error: 'You cannot change your own role or status' }, { status: 409 })
  }

  const body = await req.json().catch(() => ({}))
  const role: string | undefined = body.role
  const isActive: boolean | undefined = typeof body.isActive === 'boolean' ? body.isActive : undefined
  if (role === undefined && isActive === undefined) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }
  if (role !== undefined && !ROLES.includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })

  const cur = await db.query(`SELECT email, role, is_active FROM admin_users WHERE id = $1`, [adminId])
  if (cur.rows.length === 0) return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
  const before = cur.rows[0]

  const nextRole = role ?? before.role
  const nextActive = isActive ?? before.is_active

  // never leave the platform without a Super Admin, never exceed the cap
  const stillSuper = nextRole === 'SUPER_ADMIN' && nextActive
  if (before.role === 'SUPER_ADMIN' && before.is_active && !stillSuper) {
    const others = await db.query(
      `SELECT count(*)::int AS n FROM admin_users WHERE role = 'SUPER_ADMIN' AND is_active AND id <> $1`,
      [adminId]
    )
    if (others.rows[0].n === 0) {
      return NextResponse.json({ error: 'This is the last active Super Admin' }, { status: 409 })
    }
  }
  if (stillSuper && !(before.role === 'SUPER_ADMIN' && before.is_active)) {
    const c = await db.query(`SELECT count(*)::int AS n FROM admin_users WHERE role = 'SUPER_ADMIN' AND is_active`)
    if (c.rows[0].n >= MAX_SUPER_ADMINS) {
      return NextResponse.json({ error: `At most ${MAX_SUPER_ADMINS} Super Admins are allowed` }, { status: 409 })
    }
  }

  await db.query(`UPDATE admin_users SET role = $2, is_active = $3, updated_at = NOW() WHERE id = $1`, [
    adminId, nextRole, nextActive,
  ])

  // A role or status change must take effect now, not at the next refresh.
  await destroyAllSessions(adminId)
  if (!nextActive) await revokeAllTrustedDevices(adminId)

  await logAdminAction({
    adminId: guard.admin.adminId,
    adminEmail: guard.admin.adminEmail,
    action: !nextActive && before.is_active ? 'admin.deactivated' : 'admin.updated',
    resourceType: 'admin_user',
    resourceId: adminId,
    oldValue: { role: before.role, isActive: before.is_active },
    newValue: { role: nextRole, isActive: nextActive },
    ip: getClientIp(req),
    userAgent: req.headers.get('user-agent') ?? undefined,
  })
  return NextResponse.json({ ok: true })
}