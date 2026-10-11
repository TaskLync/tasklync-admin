import { Pool } from 'pg'

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined
}

export const db =
  global._pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    ssl:
      process.env.DATABASE_URL?.includes('supabase.com') ||
      process.env.DATABASE_URL?.includes('aws') ||
      process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : undefined,
  })

if (process.env.NODE_ENV !== 'production') global._pgPool = db