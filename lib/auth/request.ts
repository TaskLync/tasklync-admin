// lib/auth/request.ts
import { verifyAccessToken } from './jwt'
import { isSessionActive } from './session'
import type { AccessTokenPayload } from '@/types/auth'

/**
 * Valid JWT AND its server-side session still exists.
 * This is what makes logout / eviction / deactivation take effect immediately
 * instead of "within 15 minutes".
 */
export async function authenticateAccessToken(token: string | undefined): Promise<AccessTokenPayload | null> {
  if (!token) return null
  let payload: AccessTokenPayload
  try {
    payload = await verifyAccessToken(token)
  } catch {
    return null
  }
  if (!(await isSessionActive(payload.sessionId))) return null
  return payload
}