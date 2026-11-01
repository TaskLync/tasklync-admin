// app/api/admin/admins/[adminId]/logout-all/route.ts
import { NextRequest, NextResponse } from 'next/server'
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
  await destroyAllSessions(adminId)
  await revokeAllTrustedDevices(adminId)

  await logAdminAction({
    adminId: guard.admin.adminId,
    adminEmail: guard.admin.adminEmail,
    action: 'admin.logged_out_everywhere',
    resourceType: 'admin_user',
    resourceId: adminId,
    ip: getClientIp(req),
    userAgent: req.headers.get('user-agent') ?? undefined,
  })
  return NextResponse.json({ ok: true })
}