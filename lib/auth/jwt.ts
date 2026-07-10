import { SignJWT, jwtVerify } from 'jose'
import type { AccessTokenPayload, MfaTempTokenPayload } from '@/types/auth'

const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!)

export async function signAccessToken(payload: Omit<AccessTokenPayload, 'type'>) {
  const ttl = Number(process.env.ADMIN_ACCESS_TOKEN_TTL ?? 900)
  return new SignJWT({ ...payload, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttl)
    .sign(secret)
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, secret)
  if (payload.type !== 'access') throw new Error('Invalid token type')
  return payload as unknown as AccessTokenPayload
}

export async function signMfaTempToken(adminId: string) {
  const ttl = Number(process.env.ADMIN_MFA_TEMP_TOKEN_TTL ?? 900)
  return new SignJWT({ sub: adminId, purpose: 'mfa_pending', type: 'mfa_temp' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttl)
    .sign(secret)
}

export async function verifyMfaTempToken(token: string): Promise<MfaTempTokenPayload> {
  const { payload } = await jwtVerify(token, secret)
  if (payload.type !== 'mfa_temp') throw new Error('Invalid token type')
  return payload as unknown as MfaTempTokenPayload
}