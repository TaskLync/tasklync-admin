// app/api/admin/users/[userId]/actions/impersonate/route.ts
// SUPER_ADMIN only. Issues a short-lived, clearly-scoped impersonation token
// and — critically — logs it, since this is the most sensitive action on
// the whole page.
import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction } from '@/lib/audit'

export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const guard = await requirePermission('users:impersonate')
  if (!guard.ok) return guard.response

  const { rows } = await db.query(`SELECT id, name FROM users WHERE id = $1`, [params.userId])
  if (rows.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const secret = new TextEncoder().encode(process.env.IMPERSONATION_JWT_SECRET!)
  const token = await new SignJWT({
    sub: params.userId,
    impersonatedBy: guard.admin.id,
    scope: 'impersonation',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('20m')
    .sign(secret)

  await logAdminAction({
    adminId: guard.admin.id,
    adminEmail: guard.admin.email,
    action: 'user.impersonation_started',
    resourceType: 'user',
    resourceId: params.userId,
    notes: `Impersonation token issued, 20 minute TTL`,
    req,
  })

  return NextResponse.json({
    ok: true,
    impersonationUrl: `${process.env.NEXT_PUBLIC_APP_URL}/auth/impersonate?token=${token}`,
  })
}