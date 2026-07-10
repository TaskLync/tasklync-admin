import Redis from 'ioredis'

declare global {
  // eslint-disable-next-line no-var
  var _redis: Redis | undefined
}

export const redis = global._redis ?? new Redis(process.env.REDIS_URL!)

if (process.env.NODE_ENV !== 'production') global._redis = redis