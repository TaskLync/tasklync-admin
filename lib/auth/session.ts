// lib/auth/session.ts
import crypto from 'crypto'
import { redis } from '@/lib/redis'
import { AUTH_CONFIG } from './config'
import { sha256 } from './crypto'
import type { AdminRole, SessionRecord } from '@/types/auth'

// Redis layout
//   admin:sess:{sid}        -> SessionRecord JSON            (TTL = remaining session life)
//   admin:rt:{sha256(rt)}   -> sid                            (current refresh token)
//   admin:rt_used:{hash}    -> {sid, at}                      (rotated-out tokens, for theft detection)
//   admin:sessions:{admin}  -> zset of sids                   (concurrent-session limit)
const sessKey = (sid: string) => `admin:sess:${sid}`
const rtKey = (hash: string) => `admin:rt:${hash}`
const rtUsedKey = (hash: string) => `admin:rt_used:${hash}`
const adminSessionsKey = (adminId: string) => `admin:sessions:${adminId}`

export interface CreateSessionInput {
  adminId: string
  email: string
  role: AdminRole
  ip: string
  userAgent: string | null
  remember: boolean
  mfaVerified: boolean
  /** Cap the lifetime (used so a session never outlives its trusted-device window). */
  maxTtlSeconds?: number
}

export interface IssuedSession {
  sid: string
  refreshToken: string
  ttlSeconds: number
  expiresAt: number
  /** true → persistent cookie, false → browser-session cookie */
  persistent: boolean
}

export async function createSession(p: CreateSessionInput): Promise<IssuedSession> {
  let ttl = !p.mfaVerified
    ? AUTH_CONFIG.mfaSetupSessionTtl
    : p.remember
      ? AUTH_CONFIG.sessionRememberTtl
      : AUTH_CONFIG.sessionShortTtl
  if (p.maxTtlSeconds !== undefined) ttl = Math.min(ttl, Math.floor(p.maxTtlSeconds))
  if (ttl < 1) throw new Error('Session TTL must be positive')

  const sid = crypto.randomBytes(16).toString('hex')
  const refreshToken = crypto.randomBytes(32).toString('hex')
  const rtHash = sha256(refreshToken)
  const now = Date.now()

  const record: SessionRecord = {
    sid,
    adminId: p.adminId,
    email: p.email,
    role: p.role,
    createdAt: new Date(now).toISOString(),
    expiresAt: now + ttl * 1000,
    ip: p.ip,
    userAgent: (p.userAgent ?? '').slice(0, 300),
    remember: p.remember,
    mfaVerified: p.mfaVerified,
    rtHash,
  }

  await redis
    .multi()
    .set(sessKey(sid), JSON.stringify(record), 'EX', ttl)
    .set(rtKey(rtHash), sid, 'EX', ttl)
    .zadd(adminSessionsKey(p.adminId), now, sid)
    .expire(adminSessionsKey(p.adminId), AUTH_CONFIG.sessionRememberTtl)
    .exec()

  await enforceSessionLimit(p.adminId, sid)

  return {
    sid,
    refreshToken,
    ttlSeconds: ttl,
    expiresAt: record.expiresAt,
    persistent: p.remember && p.mfaVerified,
  }
}

async function enforceSessionLimit(adminId: string, keepSid: string) {
  const key = adminSessionsKey(adminId)
  const sids = await redis.zrange(key, 0, -1) // oldest first
  if (sids.length <= AUTH_CONFIG.maxConcurrentSessions) return

  const pipe = redis.multi()
  sids.forEach((s) => pipe.exists(sessKey(s)))
  const results = await pipe.exec()

  const alive: string[] = []
  const dead: string[] = []
  sids.forEach((s, i) => (results?.[i]?.[1] === 1 ? alive : dead).push(s))

  if (dead.length) await redis.zrem(key, ...dead)

  const overflow = alive.length - AUTH_CONFIG.maxConcurrentSessions
  if (overflow > 0) {
    const victims = alive.filter((s) => s !== keepSid).slice(0, overflow)
    for (const sid of victims) await destroySession(sid)
  }
}

export async function getSessionBySid(sid: string): Promise<SessionRecord | null> {
  const raw = await redis.get(sessKey(sid))
  return raw ? (JSON.parse(raw) as SessionRecord) : null
}

export async function isSessionActive(sid: string): Promise<boolean> {
  return (await redis.exists(sessKey(sid))) === 1
}

export type RotateResult =
  | {
      ok: true
      kind: 'rotated'
      record: SessionRecord
      refreshToken: string
      ttlSeconds: number
      persistent: boolean
    }
  | { ok: true; kind: 'grace'; record: SessionRecord }
  | { ok: false; reason: 'invalid' | 'expired' | 'reuse'; record?: SessionRecord }

/**
 * Rotates the refresh token. The absolute expiry (record.expiresAt) is NEVER extended,
 * so a session dies at most 7 days after login no matter how often it refreshes.
 */
export async function rotateSession(oldRefreshToken: string): Promise<RotateResult> {
  const oldHash = sha256(oldRefreshToken)

  // Atomic: only one concurrent request can consume a given token.
  const sid = await redis.getdel(rtKey(oldHash))

  if (!sid) {
    const usedRaw = await redis.get(rtUsedKey(oldHash))
    if (!usedRaw) return { ok: false, reason: 'invalid' }

    const used = JSON.parse(usedRaw) as { sid: string; at: number }
    const record = await getSessionBySid(used.sid)
    if (!record) return { ok: false, reason: 'invalid' }

    // Two tabs refreshing at the same instant: tolerate, hand out an access token only.
    if (Date.now() - used.at <= AUTH_CONFIG.refreshGraceSeconds * 1000) {
      return { ok: true, kind: 'grace', record }
    }

    // A rotated-out token replayed later = stolen token. Kill the whole session.
    await destroySession(used.sid)
    return { ok: false, reason: 'reuse', record }
  }

  const record = await getSessionBySid(sid)
  if (!record) return { ok: false, reason: 'invalid' }

  const remainingMs = record.expiresAt - Date.now()
  if (remainingMs <= 0) {
    await destroySession(sid)
    return { ok: false, reason: 'expired', record }
  }
  const ttl = Math.ceil(remainingMs / 1000)

  const refreshToken = crypto.randomBytes(32).toString('hex')
  const newHash = sha256(refreshToken)
  record.rtHash = newHash

  await redis
    .multi()
    .set(sessKey(sid), JSON.stringify(record), 'EX', ttl)
    .set(rtKey(newHash), sid, 'EX', ttl)
    .set(rtUsedKey(oldHash), JSON.stringify({ sid, at: Date.now() }), 'EX', ttl)
    .exec()

  return {
    ok: true,
    kind: 'rotated',
    record,
    refreshToken,
    ttlSeconds: ttl,
    persistent: record.remember && record.mfaVerified,
  }
}

export async function destroySession(sid: string): Promise<void> {
  const record = await getSessionBySid(sid)
  const pipe = redis.multi().del(sessKey(sid))
  if (record) {
    pipe.del(rtKey(record.rtHash))
    pipe.zrem(adminSessionsKey(record.adminId), sid)
  }
  await pipe.exec()
}

export async function destroySessionByRefreshToken(refreshToken: string): Promise<SessionRecord | null> {
  const hash = sha256(refreshToken)
  let sid = await redis.get(rtKey(hash))
  if (!sid) {
    const usedRaw = await redis.get(rtUsedKey(hash))
    if (usedRaw) sid = (JSON.parse(usedRaw) as { sid: string }).sid
  }
  if (!sid) return null
  const record = await getSessionBySid(sid)
  await destroySession(sid)
  return record
}

/** Call on: password change, MFA reset, admin deactivated/banned, "log out everywhere". */
export async function destroyAllSessions(adminId: string): Promise<void> {
  const sids = await redis.zrange(adminSessionsKey(adminId), 0, -1)
  for (const sid of sids) await destroySession(sid)
  await redis.del(adminSessionsKey(adminId))
}