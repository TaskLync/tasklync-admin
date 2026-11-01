// lib/cache.ts  (server only)
import { redis } from '@/lib/redis'

/** Call after any user warn / suspend / unsuspend / ban / contact edit. Requires the SHARED Redis. */
export async function clearUserCaches(userId: string): Promise<void> {
  try {
    await redis.del(`user:status:${userId}`, `chat:acct:user:${userId}`, `contact:user:${userId}`)
  } catch (err) {
    console.warn('[cache] could not clear user caches', userId, err instanceof Error ? err.message : err)
  }
}