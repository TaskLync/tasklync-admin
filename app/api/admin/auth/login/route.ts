export const runtime = 'nodejs'

import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { redis } from '@/lib/redis'
import { verifyPassword, hashPassword } from '@/lib/auth/password'
import { signMfaTempToken } from '@/lib/auth/jwt'
import { createSession } from '@/lib/auth/session'
import { findTrustedDevice } from '@/lib/auth/trusted-device'
import { buildAuthResponse, markLoginSuccess } from '@/lib/auth/issue'
import { COOKIE, setMfaTempCookie } from '@/lib/auth/cookies'
import { AUTH_CONFIG } from '@/lib/auth/config'
import { hit } from '@/lib/auth/rate-limit'
import { getClientIp, getUserAgent, logAuthEvent } from '@/lib/audit'

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(1).max(128),
})

// Compared against when the email does not exist, so "no account" costs the same time as "wrong password".
const dummyHash = hashPassword(crypto.randomBytes(16).toString('hex'))

const genericError = () => NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })

function tooMany(retryAfter: number) {
  return NextResponse.json(
    { error: 'Too many attempts. Please wait a few minutes and try again.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  )
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const userAgent = getUserAgent(req)

  const ipLimit = await hit(`login:ip:${ip}`, 30, 900)
  if (!ipLimit.allowed) return tooMany(ipLimit.retryAfter)

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const body = schema.safeParse(raw)
  if (!body.success) {
    return NextResponse.json({ error: 'Invalid email or password format' }, { status: 400 })
  }
  const { email, password } = body.data

  const emailLimit = await hit(`login:email:${email}`, 15, 900)
  if (!emailLimit.allowed) return tooMany(emailLimit.retryAfter)

  const { rows } = await db.query('SELECT * FROM admin_users WHERE LOWER(email) = $1', [email])
  const admin = rows[0]

  const isLocked = Boolean(admin?.locked_until && new Date(admin.locked_until) > new Date())
  const valid = await verifyPassword(password, admin?.password_hash ?? (await dummyHash))

  if (!admin || !admin.is_active || !valid) {
    // Atomic increment: parallel guesses cannot out-run the lockout.
    if (admin?.is_active && !valid && !isLocked) {
      const { rows: upd } = await db.query(
        `UPDATE admin_users
            SET failed_attempts = COALESCE(failed_attempts, 0) + 1,
                locked_until = CASE WHEN COALESCE(failed_attempts, 0) + 1 >= $2
                                    THEN NOW() + make_interval(mins => $3::int)
                                    ELSE locked_until END
          WHERE id = $1
      RETURNING failed_attempts`,
        [admin.id, AUTH_CONFIG.maxFailedAttempts, AUTH_CONFIG.lockoutMinutes]
      )
      await logAuthEvent({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'auth.login_failed',
        ip,
        userAgent: userAgent ?? undefined,
        notes: `Failed attempt ${upd[0]?.failed_attempts}/${AUTH_CONFIG.maxFailedAttempts}`,
      })
    }
    return genericError()
  }

  // Only someone who knows the right password learns the account is locked (no enumeration).
  if (isLocked) {
    return NextResponse.json(
      { error: `Account locked. Try again after ${new Date(admin.locked_until).toLocaleTimeString()}.` },
      { status: 423 }
    )
  }

  const adminRow = {
    id: admin.id,
    email: admin.email,
    full_name: admin.full_name,
    role: admin.role,
    mfa_enabled: Boolean(admin.mfa_enabled),
  }

  // ---- MFA enrolled -----------------------------------------------------------
  if (admin.mfa_enabled) {
    // Trusted device? Skip the code. Session never outlives the trust window.
    const trusted = await findTrustedDevice(admin.id, req.cookies.get(COOKIE.device)?.value)
    if (trusted) {
      const maxTtlSeconds = Math.floor((trusted.expiresAt.getTime() - Date.now()) / 1000)
      if (maxTtlSeconds > 60) {
        const session = await createSession({
          adminId: admin.id,
          email: admin.email,
          role: admin.role,
          ip,
          userAgent,
          remember: true,
          mfaVerified: true,
          maxTtlSeconds,
        })
        await markLoginSuccess(admin.id, ip)
        await logAuthEvent({
          adminId: admin.id,
          adminEmail: admin.email,
          action: 'auth.login_trusted_device',
          ip,
          userAgent: userAgent ?? undefined,
        })
        return buildAuthResponse({ admin: adminRow, session, scope: 'full' })
      }
    }

    const { token, jti } = await signMfaTempToken(admin.id)
    await redis.set(`admin:mfa_tmp:${jti}`, admin.id, 'EX', AUTH_CONFIG.mfaTempTtl)
    await logAuthEvent({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'auth.login_mfa_pending',
      ip,
      userAgent: userAgent ?? undefined,
    })
    const res = NextResponse.json({ requiresMFA: true })
    setMfaTempCookie(res, token) // httpOnly, only sent to /api/admin/auth/mfa/*
    return res
  }

  // ---- No MFA yet -------------------------------------------------------------
  if (AUTH_CONFIG.mfaRequired) {
    // Limited session: can reach the MFA setup page/API and nothing else.
    const session = await createSession({
      adminId: admin.id,
      email: admin.email,
      role: admin.role,
      ip,
      userAgent,
      remember: false,
      mfaVerified: false,
    })
    await logAuthEvent({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'auth.login_mfa_setup_required',
      ip,
      userAgent: userAgent ?? undefined,
    })
    return buildAuthResponse({
      admin: adminRow,
      session,
      scope: 'mfa_setup',
      body: { mfaSetupRequired: true },
    })
  }

  const session = await createSession({
    adminId: admin.id,
    email: admin.email,
    role: admin.role,
    ip,
    userAgent,
    remember: false,
    mfaVerified: true,
  })
  await markLoginSuccess(admin.id, ip)
  await logAuthEvent({
    adminId: admin.id,
    adminEmail: admin.email,
    action: 'auth.login_success',
    ip,
    userAgent: userAgent ?? undefined,
  })
  return buildAuthResponse({ admin: adminRow, session, scope: 'full' })
}