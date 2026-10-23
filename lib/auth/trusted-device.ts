// lib/auth/trusted-device.ts
import crypto from 'crypto'
import { db } from '@/lib/db'
import { AUTH_CONFIG } from './config'
import { sha256, safeEqual } from './crypto'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Cookie value = "<uuid>.<secret>". Only sha256(secret) is stored. */
export async function issueTrustedDevice(
  adminId: string,
  ip: string,
  userAgent: string | null
): Promise<{ token: string; ttlSeconds: number }> {
  const id = crypto.randomUUID()
  const secret = crypto.randomBytes(32).toString('hex')

  await db.query(
    `INSERT INTO admin_trusted_devices (id, admin_id, token_hash, ip_address, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5, NOW() + make_interval(secs => $6::double precision))`,
    [id, adminId, sha256(secret), ip, userAgent?.slice(0, 500) ?? null, AUTH_CONFIG.trustedDeviceTtl]
  )

  // opportunistic cleanup, never blocks login
  db.query(`DELETE FROM admin_trusted_devices WHERE expires_at < NOW() - INTERVAL '30 days'`).catch(() => {})

  return { token: `${id}.${secret}`, ttlSeconds: AUTH_CONFIG.trustedDeviceTtl }
}

/** The token must belong to THIS admin: another admin on the same browser still gets an MFA prompt. */
export async function findTrustedDevice(
  adminId: string,
  token: string | undefined
): Promise<{ id: string; expiresAt: Date } | null> {
  if (!token) return null
  const [id, secret] = token.split('.')
  if (!id || !secret || !UUID_RE.test(id)) return null

  const { rows } = await db.query(
    `SELECT id, token_hash, expires_at
       FROM admin_trusted_devices
      WHERE id = $1 AND admin_id = $2 AND revoked_at IS NULL AND expires_at > NOW()`,
    [id, adminId]
  )
  const row = rows[0]
  if (!row || !safeEqual(sha256(secret), String(row.token_hash).trim())) return null

  db.query('UPDATE admin_trusted_devices SET last_used_at = NOW() WHERE id = $1', [id]).catch(() => {})
  return { id: row.id, expiresAt: new Date(row.expires_at) }
}

export async function revokeTrustedDeviceByToken(adminId: string, token: string | undefined) {
  const id = token?.split('.')[0]
  if (!id || !UUID_RE.test(id)) return
  await db.query(
    'UPDATE admin_trusted_devices SET revoked_at = NOW() WHERE id = $1 AND admin_id = $2 AND revoked_at IS NULL',
    [id, adminId]
  )
}

/** Call on: password change, MFA reset/disable, admin banned, "log out everywhere". */
export async function revokeAllTrustedDevices(adminId: string) {
  await db.query(
    'UPDATE admin_trusted_devices SET revoked_at = NOW() WHERE admin_id = $1 AND revoked_at IS NULL',
    [adminId]
  )
}