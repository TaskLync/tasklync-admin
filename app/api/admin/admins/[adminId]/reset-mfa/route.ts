// app/api/admin/admins/[adminId]/reset-mfa/route.ts
// For an admin who lost the authenticator AND the backup codes. They enrol again at the next login.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { redis } from '@/lib/redis'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { destroyAllSessions } from '@/lib/auth/session'
import { revokeAllTrustedDevices } from '@/lib/auth/trusted-device'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ adminId: string }> }
) {
  const guard = await requirePermission('admin_users:manage')
  if (!guard.ok) return guard.response

  const { adminId } = await params
  if (adminId === guard.admin.adminId) {
    return NextResponse.json({ error: 'Ask another Super Admin to reset your MFA' }, { status: 409 })
  }

  const { rowCount } = await db.query(
    `UPDATE admin_users
        SET mfa_enabled = FALSE, mfa_secret = NULL, failed_attempts = 0, locked_until = NULL, updated_at = NOW()
      WHERE id = $1`,
    [adminId]
  )
  if (!rowCount) return NextResponse.json({ error: 'Admin not found' }, { status: 404 })

  await db.query(`DELETE FROM admin_mfa_backup_codes WHERE admin_id = $1`, [adminId])
  await revokeAllTrustedDevices(adminId)
  await destroyAllSessions(adminId)
  await redis.del(`admin:mfa_fail:${adminId}`, `admin:mfa_pending:${adminId}`).catch(() => {})

  await logAdminAction({
    adminId: guard.admin.adminId,
    adminEmail: guard.admin.adminEmail,
    action: 'admin.mfa_reset',
    resourceType: 'admin_user',
    resourceId: adminId,
    ip: getClientIp(req),
    userAgent: req.headers.get('user-agent') ?? undefined,
  })
  return NextResponse.json({ ok: true })
}