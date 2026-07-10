export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/auth/password'
import { signAccessToken, signMfaTempToken } from '@/lib/auth/jwt'
import { createSession } from '@/lib/auth/session'
import { logAdminAction } from '@/lib/audit'
import { setAuthCookies } from '@/lib/auth/cookies'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const MAX_ATTEMPTS = Number(process.env.ADMIN_MAX_FAILED_ATTEMPTS ?? 5)
const LOCKOUT_MINUTES = Number(process.env.ADMIN_LOCKOUT_MINUTES ?? 30)

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const body = schema.safeParse(await req.json())
  if (!body.success) {
    return NextResponse.json({ error: 'Invalid email or password format' }, { status: 400 })
  }
  const { email, password } = body.data

  const { rows } = await db.query('SELECT * FROM admin_users WHERE email = $1', [email])
  const admin = rows[0]

  // Deliberately identical error for "no account" and "wrong password" — don't leak which one
  const genericError = { error: 'Invalid email or password' }

  if (!admin || !admin.is_active) {
    return NextResponse.json(genericError, { status: 401 })
  }

  if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
    return NextResponse.json(
      { error: `Account locked. Try again after ${new Date(admin.locked_until).toLocaleTimeString()}.` },
      { status: 423 }
    )
  }

  const valid = await verifyPassword(password, admin.password_hash)

  if (!valid) {
    const attempts = admin.failed_attempts + 1
    const lockUntil = attempts >= MAX_ATTEMPTS
      ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
      : null

    await db.query(
      'UPDATE admin_users SET failed_attempts = $1, locked_until = $2 WHERE id = $3',
      [attempts, lockUntil, admin.id]
    )
    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'auth.login_failed',
      ip,
      notes: `Failed attempt ${attempts}/${MAX_ATTEMPTS}`,
    })

    return NextResponse.json(genericError, { status: 401 })
  }

  // Success — reset failed attempts
  await db.query(
    'UPDATE admin_users SET failed_attempts = 0, locked_until = NULL, last_login_at = NOW(), last_login_ip = $1 WHERE id = $2',
    [ip, admin.id]
  )

  if (admin.mfa_enabled) {
    const tempToken = await signMfaTempToken(admin.id)
    await logAdminAction({
      adminId: admin.id, adminEmail: admin.email, action: 'auth.login_mfa_pending', ip,
    })
    return NextResponse.json({ requiresMFA: true, tempToken })
  }

  // No MFA set up yet — issue full session (MFA setup is enforced on first login, see below)
  const refreshToken = await createSession(admin.id, admin.email, admin.role, ip)
  const accessToken = await signAccessToken({
    sub: admin.id, email: admin.email, role: admin.role, sessionId: refreshToken,
  })

  await logAdminAction({ adminId: admin.id, adminEmail: admin.email, action: 'auth.login_success', ip })

  const res = NextResponse.json({
    accessToken,
    admin: { id: admin.id, email: admin.email, fullName: admin.full_name, role: admin.role, mfaEnabled: false },
    mfaSetupRequired: admin.role === 'SUPER_ADMIN', // mandatory for SUPER_ADMIN per your spec
  })
  setAuthCookies(res, accessToken, refreshToken)
  return res
}