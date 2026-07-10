// lib/rbac-guard.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth/jwt'
import { hasPermission } from '@/lib/auth/rbac'
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
  const token = cookieStore.get('admin_access')?.value

  if (!token) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  let payload
  try {
    payload = await verifyAccessToken(token)
  } catch {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
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