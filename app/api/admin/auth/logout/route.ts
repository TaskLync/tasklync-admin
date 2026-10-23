export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessToken } from '@/lib/auth/jwt'
import { destroySession, destroySessionByRefreshToken } from '@/lib/auth/session'
import { revokeTrustedDeviceByToken } from '@/lib/auth/trusted-device'
import { COOKIE, clearAuthCookies, clearDeviceCookie } from '@/lib/auth/cookies'
import { getClientIp, getUserAgent, logAuthEvent } from '@/lib/audit'

// POST /api/admin/auth/logout            -> log out, device stays trusted (no code next time within 7 days)
// POST /api/admin/auth/logout?forget=1   -> log out AND forget this device (use on shared computers)
export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const forget = req.nextUrl.searchParams.get('forget') === '1'

  let adminId: string | null = null
  let email: string | null = null

  const accessToken = req.cookies.get(COOKIE.access)?.value
  if (accessToken) {
    const payload = await verifyAccessToken(accessToken).catch(() => null)
    if (payload) {
      await destroySession(payload.sessionId)
      adminId = payload.sub
      email = payload.email
    }
  }

  const refreshToken = req.cookies.get(COOKIE.session)?.value
  if (refreshToken) {
    const record = await destroySessionByRefreshToken(refreshToken)
    if (record && !adminId) {
      adminId = record.adminId
      email = record.email
    }
  }

  if (forget && adminId) {
    await revokeTrustedDeviceByToken(adminId, req.cookies.get(COOKIE.device)?.value)
  }

  if (adminId && email) {
    await logAuthEvent({
      adminId,
      adminEmail: email,
      action: forget ? 'auth.logout_forget_device' : 'auth.logout',
      ip,
      userAgent: getUserAgent(req) ?? undefined,
    })
  }

  const res = NextResponse.json({ ok: true })
  clearAuthCookies(res) // BOTH cookies (the old code left admin_access alive for up to 15 min)
  if (forget) clearDeviceCookie(res)
  return res
}