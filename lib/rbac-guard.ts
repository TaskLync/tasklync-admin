// lib/rbac-guard.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { authenticateAccessToken } from '@/lib/auth/request'
import { hasPermission } from '@/lib/auth/rbac'
import { COOKIE } from '@/lib/auth/cookies'
import type { AdminRole } from '@/types/auth'

interface AdminContext {
  adminId: string
  adminEmail: string
  role: AdminRole
  sessionId: string
}

type PermissionResult =
  | { ok: true; admin: AdminContext }
  | { ok: false; response: NextResponse }

export async function requirePermission(permission: string): Promise<PermissionResult> {
  const cookieStore = await cookies()
  const payload = await authenticateAccessToken(cookieStore.get(COOKIE.access)?.value)

  if (!payload) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  // A password-only session (MFA not enrolled yet) can never reach admin data.
  if (payload.scope !== 'full') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'MFA setup required', code: 'MFA_SETUP_REQUIRED' }, { status: 403 }),
    }
  }

  if (!hasPermission(payload.role, permission)) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return {
    ok: true,
    admin: {
      adminId: payload.sub,
      adminEmail: payload.email,
      role: payload.role,
      sessionId: payload.sessionId,
    },
  }
}