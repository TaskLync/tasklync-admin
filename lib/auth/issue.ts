// lib/auth/issue.ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { signAccessToken } from './jwt'
import { setAccessCookie, setSessionCookie } from './cookies'
import type { IssuedSession } from './session'
import type { AccessScope, AdminRole } from '@/types/auth'

export interface AdminRow {
  id: string
  email: string
  full_name: string
  role: AdminRole
  mfa_enabled: boolean
}

export async function buildAuthResponse(opts: {
  admin: AdminRow
  session: IssuedSession
  scope: AccessScope
  body?: Record<string, unknown>
}): Promise<NextResponse> {
  const { admin, session, scope, body } = opts

  const accessToken = await signAccessToken({
    sub: admin.id,
    email: admin.email,
    role: admin.role,
    sessionId: session.sid,
    scope,
  })

  // Tokens travel ONLY in httpOnly cookies. Never in the JSON body.
  const res = NextResponse.json({
    admin: {
      id: admin.id,
      email: admin.email,
      fullName: admin.full_name,
      role: admin.role,
      mfaEnabled: admin.mfa_enabled,
    },
    ...body,
  })
  setAccessCookie(res, accessToken)
  setSessionCookie(res, session.refreshToken, session.persistent ? session.ttlSeconds : null)
  return res
}

/** Called only when a session is actually issued, not after the password step alone. */
export async function markLoginSuccess(adminId: string, ip: string) {
  await db.query(
    `UPDATE admin_users
        SET failed_attempts = 0, locked_until = NULL, last_login_at = NOW(), last_login_ip = $1
      WHERE id = $2`,
    [ip, adminId]
  )
}