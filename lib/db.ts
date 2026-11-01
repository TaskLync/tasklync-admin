import { Pool } from 'pg'

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined
}

function sslConfig() {
  const url = process.env.DATABASE_URL ?? ''
  const wantsSsl =
    url.includes('supabase') ||
    url.includes('aws') ||
    process.env.DATABASE_SSL === 'true' ||
    process.env.NODE_ENV === 'production'
  if (!wantsSsl) return undefined

  const ca = process.env.DATABASE_CA_CERT
  if (ca) {
    const pem = ca.includes('BEGIN CERTIFICATE')
      ? ca.replace(/\\n/g, '\n')
      : Buffer.from(ca, 'base64').toString('utf8')
    return { ca: pem, rejectUnauthorized: true }
  }

  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
    console.warn('[db] DATABASE_CA_CERT is not set: TLS is encrypted but the server certificate is NOT verified.')
  }
  return { rejectUnauthorized: false }
}

export const db =
  global._pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    ssl: sslConfig(),
  })

if (process.env.NODE_ENV !== 'production') global._pgPool = db