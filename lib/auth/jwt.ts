// lib/auth/jwt.ts  (edge-safe: middleware imports verifyAccessToken)
import { SignJWT, jwtVerify } from 'jose'
import { AUTH_CONFIG } from './config'
import type {
  AccessScope,
  AccessTokenPayload,
  AdminRole,
  MfaTempTokenPayload,
} from '@/types/auth'

let cachedSecret: Uint8Array | null = null

function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret
  const bytes = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET ?? '')
  if (bytes.length < 32) {
    throw new Error('ADMIN_JWT_SECRET must be set and at least 32 bytes long')
  }
  cachedSecret = bytes
  return bytes
}

export async function signAccessToken(p: {
  sub: string
  email: string
  role: AdminRole
  sessionId: string
  scope: AccessScope
}) {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ email: p.email, role: p.role, sessionId: p.sessionId, scope: p.scope, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(p.sub)
    .setIssuer(AUTH_CONFIG.issuer)
    .setAudience(AUTH_CONFIG.audience)
    .setIssuedAt(now)
    .setExpirationTime(now + AUTH_CONFIG.accessTtl)
    .sign(getSecret())
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret(), {
    algorithms: ['HS256'],
    issuer: AUTH_CONFIG.issuer,
    audience: AUTH_CONFIG.audience,
    clockTolerance: 5,
  })
  if (payload.type !== 'access') throw new Error('Invalid token type')
  if (payload.scope !== 'full' && payload.scope !== 'mfa_setup') throw new Error('Invalid scope')
  if (typeof payload.sub !== 'string' || typeof payload.sessionId !== 'string') {
    throw new Error('Malformed token')
  }
  return payload as unknown as AccessTokenPayload
}

export async function signMfaTempToken(adminId: string): Promise<{ token: string; jti: string }> {
  const jti = crypto.randomUUID()
  const now = Math.floor(Date.now() / 1000)
  const token = await new SignJWT({ purpose: 'mfa_pending', type: 'mfa_temp' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(adminId)
    .setJti(jti)
    .setIssuer(AUTH_CONFIG.issuer)
    .setAudience(AUTH_CONFIG.mfaAudience) // different audience: can never pass as an access token
    .setIssuedAt(now)
    .setExpirationTime(now + AUTH_CONFIG.mfaTempTtl)
    .sign(getSecret())
  return { token, jti }
}

export async function verifyMfaTempToken(token: string): Promise<MfaTempTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret(), {
    algorithms: ['HS256'],
    issuer: AUTH_CONFIG.issuer,
    audience: AUTH_CONFIG.mfaAudience,
    clockTolerance: 5,
  })
  if (payload.type !== 'mfa_temp' || payload.purpose !== 'mfa_pending') {
    throw new Error('Invalid token type')
  }
  if (typeof payload.sub !== 'string' || typeof payload.jti !== 'string') {
    throw new Error('Malformed token')
  }
  return payload as unknown as MfaTempTokenPayload
}