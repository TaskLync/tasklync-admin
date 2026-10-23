export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { redis } from '@/lib/redis'
import { verifyMfaTempToken } from '@/lib/auth/jwt'
import {
  verifyTotp,
  claimTotpCode,
  verifyBackupCode,
  normalizeBackupCode,
} from '@/lib/auth/mfa'
import { decryptSecret, encryptSecret, isEncrypted } from '@/lib/auth/crypto'
import { createSession } from '@/lib/auth/session'
import { issueTrustedDevice } from '@/lib/auth/trusted-device'
import { buildAuthResponse, markLoginSuccess } from '@/lib/auth/issue'
import { clearMfaTempCookie, COOKIE, setDeviceCookie } from '@/lib/auth/cookies'
import { AUTH_CONFIG } from '@/lib/auth/config'
import { hit } from '@/lib/auth/rate-limit'
import { getClientIp, getUserAgent, logAuthEvent } from '@/lib/audit'

const schema = z.object({
  code: z.string().trim().min(6).max(16),
  remember: z.boolean().optional(),
})

function expired() {
  const res = NextResponse.json({ error: 'MFA session expired, please sign in again' }, { status: 401 })
  clearMfaTempCookie(res)
  return res
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const userAgent = getUserAgent(req)

  const ipLimit = await hit(`mfa:ip:${ip}`, 40, 900)
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a few minutes.' },
      { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfter) } }
    )
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const body = schema.safeParse(raw)
  if (!body.success) return NextResponse.json({ error: 'Invalid code' }, { status: 400 })

  // The challenge lives in an httpOnly cookie and is single-use (jti in Redis).
  const tempCookie = req.cookies.get(COOKIE.mfa)?.value
  if (!tempCookie) return expired()

  let adminId: string
  let jti: string
  try {
    const payload = await verifyMfaTempToken(tempCookie)
    adminId = payload.sub
    jti = payload.jti
  } catch {
    return expired()
  }

  const tmpKey = `admin:mfa_tmp:${jti}`
  if ((await redis.get(tmpKey)) !== adminId) return expired()

  const failKey = `admin:mfa_fail:${adminId}`
  const failures = Number((await redis.get(failKey)) ?? 0)
  if (failures >= AUTH_CONFIG.mfaMaxAttempts) {
    await redis.del(tmpKey)
    return NextResponse.json(
      { error: 'Too many incorrect codes. Please sign in again later.' },
      { status: 429 }
    )
  }

  const { rows } = await db.query('SELECT * FROM admin_users WHERE id = $1', [adminId])
  const admin = rows[0]
  if (!admin || !admin.is_active) {
    await redis.del(tmpKey)
    return expired()
  }

  const code = body.data.code
  const secret: string | null = admin.mfa_secret ? decryptSecret(admin.mfa_secret) : null
  let method: 'totp' | 'backup' | null = null

  if (/^\d{6}$/.test(code)) {
    if (secret && verifyTotp(code, secret) && (await claimTotpCode(adminId, code))) method = 'totp'
  } else {
    const normalized = normalizeBackupCode(code)
    if (normalized) {
      const { rows: backupRows } = await db.query(
        'SELECT id, code_hash FROM admin_mfa_backup_codes WHERE admin_id = $1 AND used_at IS NULL',
        [adminId]
      )
      const idx = await verifyBackupCode(normalized, backupRows.map((r) => r.code_hash))
      if (idx !== -1) {
        // Atomic claim: two parallel requests cannot both spend the same backup code.
        const claim = await db.query(
          'UPDATE admin_mfa_backup_codes SET used_at = NOW() WHERE id = $1 AND used_at IS NULL RETURNING id',
          [backupRows[idx].id]
        )
        if (claim.rowCount === 1) method = 'backup'
      }
    }
  }

  if (!method) {
    const n = await redis.incr(failKey)
    if (n === 1) await redis.expire(failKey, 900)

    await logAuthEvent({
      adminId,
      adminEmail: admin.email,
      action: 'auth.mfa_failed',
      ip,
      userAgent: userAgent ?? undefined,
      notes: `Failure ${n}/${AUTH_CONFIG.mfaMaxAttempts}`,
    })

    if (n >= AUTH_CONFIG.mfaMaxAttempts) {
      await redis.del(tmpKey) // burn the challenge: the attacker must pass the password step again
      await db.query(
        `UPDATE admin_users SET locked_until = NOW() + make_interval(mins => $2::int) WHERE id = $1`,
        [adminId, AUTH_CONFIG.lockoutMinutes]
      )
      await logAuthEvent({
        adminId,
        adminEmail: admin.email,
        action: 'auth.mfa_lockout',
        ip,
        userAgent: userAgent ?? undefined,
      })
    }
    return NextResponse.json({ error: 'Invalid code' }, { status: 401 })
  }

  // ---- success ----------------------------------------------------------------
  await redis.del(tmpKey, failKey)

  // Lazily encrypt legacy plaintext secrets.
  if (admin.mfa_secret && secret && !isEncrypted(admin.mfa_secret)) {
    await db.query('UPDATE admin_users SET mfa_secret = $1 WHERE id = $2', [encryptSecret(secret), adminId])
  }

  const remember = body.data.remember === true
  const session = await createSession({
    adminId: admin.id,
    email: admin.email,
    role: admin.role,
    ip,
    userAgent,
    remember,
    mfaVerified: true,
    maxTtlSeconds: remember ? AUTH_CONFIG.trustedDeviceTtl : undefined,
  })
  await markLoginSuccess(admin.id, ip)
  await logAuthEvent({
    adminId: admin.id,
    adminEmail: admin.email,
    ip,
    userAgent: userAgent ?? undefined,
    action: method === 'backup' ? 'auth.mfa_success_backup_code' : 'auth.mfa_success',
    notes: remember ? 'remember_device=true' : undefined,
  })

  const res = await buildAuthResponse({
    admin: {
      id: admin.id,
      email: admin.email,
      full_name: admin.full_name,
      role: admin.role,
      mfa_enabled: true,
    },
    session,
    scope: 'full',
  })
  clearMfaTempCookie(res)

  if (remember) {
    const device = await issueTrustedDevice(admin.id, ip, userAgent)
    setDeviceCookie(res, device.token, device.ttlSeconds)
  }
  return res
}