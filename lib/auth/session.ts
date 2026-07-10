import { redis } from '@/lib/redis'
import crypto from 'crypto'
import type { AdminRole, SessionRecord } from '@/types/auth'

const REFRESH_TTL = Number(process.env.ADMIN_REFRESH_TOKEN_TTL ?? 28800)
const MAX_SESSIONS = Number(process.env.ADMIN_MAX_CONCURRENT_SESSIONS ?? 2)

function sessionKey(refreshToken: string) {
  return `admin:session:${refreshToken}`
}
function sessionSetKey(adminId: string) {
  return `admin:sessions:${adminId}`
}

export async function createSession(
  adminId: string,
  email: string,
  role: AdminRole,
  ip: string
): Promise<string> {
  const refreshToken = crypto.randomBytes(32).toString('hex')
  const record: SessionRecord = { adminId, email, role, createdAt: new Date().toISOString(), ip }

  await redis.set(sessionKey(refreshToken), JSON.stringify(record), 'EX', REFRESH_TTL)

  // Track sessions per admin, evict oldest if over the concurrent-session limit
  const setKey = sessionSetKey(adminId)
  await redis.zadd(setKey, Date.now(), refreshToken)
  const count = await redis.zcard(setKey)
  if (count > MAX_SESSIONS) {
    const toEvict = await redis.zrange(setKey, 0, count - MAX_SESSIONS - 1)
    if (toEvict.length) {
      await redis.del(...toEvict.map(sessionKey))
      await redis.zrem(setKey, ...toEvict)
    }
  }
  await redis.expire(setKey, REFRESH_TTL)

  return refreshToken
}

export async function getSession(refreshToken: string): Promise<SessionRecord | null> {
  const raw = await redis.get(sessionKey(refreshToken))
  return raw ? JSON.parse(raw) : null
}

export async function rotateSession(oldRefreshToken: string): Promise<string | null> {
  const record = await getSession(oldRefreshToken)
  if (!record) return null

  await redis.del(sessionKey(oldRefreshToken))
  await redis.zrem(sessionSetKey(record.adminId), oldRefreshToken)

  return createSession(record.adminId, record.email, record.role, record.ip)
}

export async function destroySession(refreshToken: string): Promise<void> {
  const record = await getSession(refreshToken)
  await redis.del(sessionKey(refreshToken))
  if (record) await redis.zrem(sessionSetKey(record.adminId), refreshToken)
}