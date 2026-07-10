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
  })

if (process.env.NODE_ENV !== 'production') global._pgPool = db