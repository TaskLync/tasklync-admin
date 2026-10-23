export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { redis } from '@/lib/redis'
import { authenticateAccessToken } from '@/lib/auth/request'
import { verifyTotp, generateBackupCodes, hashBackupCodes } from '@/lib/auth/mfa'
import { encryptSecret } from '@/lib/auth/crypto'
import { createSession, destroySession } from '@/lib/auth/session'
import { issueTrustedDevice } from '@/lib/auth/trusted-device'
import { buildAuthResponse, markLoginSuccess } from '@/lib/auth/issue'
import { COOKIE, setDeviceCookie } from '@/lib/auth/cookies'
import { AUTH_CONFIG } from '@/lib/auth/config'
import { hit } from '@/lib/auth/rate-limit'
import { getClientIp, getUserAgent, logAuthEvent } from '@/lib/audit'

const schema = z.object({ code: z.string().trim().regex(/^\d{6}$/) })

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const userAgent = getUserAgent(req)

  const payload = await authenticateAccessToken(req.cookies.get(COOKIE.access)?.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = await hit(`mfa-setup-confirm:${payload.sub}`, 8, 600)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many attempts. Try again in a few minutes.' }, { status: 429 })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
  }
  const body = schema.safeParse(raw)
  if (!body.success) return NextResponse.json({ error: 'Invalid code' }, { status: 400 })

  const { rows } = await db.query(
    'SELECT id, email, full_name, role, is_active, mfa_enabled FROM admin_users WHERE id = $1',
    [payload.sub]
  )
  const admin = rows[0]
  if (!admin || !admin.is_active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (admin.mfa_enabled) {
    return NextResponse.json({ error: 'Two factor authentication is already enabled.' }, { status: 409 })
  }

  const pendingSecret = await redis.get(`admin:mfa_pending:${payload.sub}`)
  if (!pendingSecret) {
    return NextResponse.json({ error: 'Setup session expired, start again' }, { status: 400 })
  }
  if (!verifyTotp(body.data.code, pendingSecret)) {
    return NextResponse.json({ error: 'Incorrect code' }, { status: 400 })
  }

  const backupCodes = generateBackupCodes(10)
  const hashes = await hashBackupCodes(backupCodes)

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const upd = await client.query(
      `UPDATE admin_users SET mfa_secret = $1, mfa_enabled = TRUE, updated_at = NOW()
        WHERE id = $2 AND mfa_enabled = FALSE RETURNING id`,
      [encryptSecret(pendingSecret), payload.sub]
    )
    if (upd.rowCount !== 1) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Two factor authentication is already enabled.' }, { status: 409 })
    }
    await client.query('DELETE FROM admin_mfa_backup_codes WHERE admin_id = $1', [payload.sub])
    await client.query(
      'INSERT INTO admin_mfa_backup_codes (admin_id, code_hash) SELECT $1, UNNEST($2::text[])',
      [payload.sub, hashes]
    )
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
  await redis.del(`admin:mfa_pending:${payload.sub}`)

  // Privilege changed (password-only -> fully verified): issue a FRESH session (new sid + refresh
  // token) instead of upgrading the old one, and trust this device since they just proved possession.
  await destroySession(payload.sessionId)
  const session = await createSession({
    adminId: admin.id,
    email: admin.email,
    role: admin.role,
    ip,
    userAgent,
    remember: true,
    mfaVerified: true,
    maxTtlSeconds: AUTH_CONFIG.trustedDeviceTtl,
  })
  await markLoginSuccess(admin.id, ip)
  await logAuthEvent({
    adminId: admin.id,
    adminEmail: admin.email,
    action: 'auth.mfa_enabled',
    ip,
    userAgent: userAgent ?? undefined,
  })

  // Backup codes are shown exactly once: plaintext, never stored, never logged.
  const res = await buildAuthResponse({
    admin: { id: admin.id, email: admin.email, full_name: admin.full_name, role: admin.role, mfa_enabled: true },
    session,
    scope: 'full',
    body: { backupCodes },
  })
  const device = await issueTrustedDevice(admin.id, ip, userAgent)
  setDeviceCookie(res, device.token, device.ttlSeconds)
  return res
}