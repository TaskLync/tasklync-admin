// lib/auth/rate-limit.ts
import { redis } from '@/lib/redis'

export interface RateLimitResult {
  allowed: boolean
  retryAfter: number // seconds
}

/** Fixed-window counter in Redis. */
export async function hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const k = `admin:rl:${key}`
  const count = await redis.incr(k)
  if (count === 1) {
    await redis.expire(k, windowSeconds)
  } else if ((await redis.ttl(k)) === -1) {
    await redis.expire(k, windowSeconds) // heal a key that lost its TTL
  }
  if (count > limit) {
    const ttl = await redis.ttl(k)
    return { allowed: false, retryAfter: ttl > 0 ? ttl : windowSeconds }
  }
  return { allowed: true, retryAfter: 0 }
}