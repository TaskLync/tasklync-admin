export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rotateSession, destroyAllSessions } from '@/lib/auth/session'
import { signAccessToken } from '@/lib/auth/jwt'
import { COOKIE, setAccessCookie, setSessionCookie, clearAuthCookies } from '@/lib/auth/cookies'
import { hit } from '@/lib/auth/rate-limit'
import { safeNextPath } from '@/lib/auth/redirect'
import { getClientIp, getUserAgent, logAuthEvent } from '@/lib/audit'

type Outcome =
  | {
      ok: true
      accessToken: string
      rotated: { token: string; ttlSeconds: number; persistent: boolean } | null
    }
  | { ok: false; status: 401 | 429; clear: boolean }

async function refresh(req: NextRequest): Promise<Outcome> {
  const ip = getClientIp(req)

  const limit = await hit(`refresh:ip:${ip}`, 120, 900)
  if (!limit.allowed) return { ok: false, status: 429, clear: false }

  const oldToken = req.cookies.get(COOKIE.session)?.value
  if (!oldToken || oldToken.length !== 64) return { ok: false, status: 401, clear: true }

  const result = await rotateSession(oldToken)
  if (!result.ok) {
    if (result.reason === 'reuse' && result.record) {
      await logAuthEvent({
        adminId: result.record.adminId,
        adminEmail: result.record.email,
        action: 'auth.refresh_reuse_detected',
        ip,
        userAgent: getUserAgent(req) ?? undefined,
        notes: 'Rotated refresh token replayed: session revoked',
      })
    }
    return { ok: false, status: 401, clear: true }
  }

  const record = result.record

  // Re-check the account at every refresh (every ~15 min): deactivation and role changes apply fast.
  const { rows } = await db.query('SELECT id, email, role, is_active FROM admin_users WHERE id = $1', [
    record.adminId,
  ])
  const admin = rows[0]
  if (!admin || !admin.is_active) {
    await destroyAllSessions(record.adminId)
    return { ok: false, status: 401, clear: true }
  }

  const accessToken = await signAccessToken({
    sub: admin.id,
    email: admin.email,
    role: admin.role,
    sessionId: record.sid,
    scope: record.mfaVerified ? 'full' : 'mfa_setup',
  })

  return {
    ok: true,
    accessToken,
    rotated:
      result.kind === 'rotated'
        ? { token: result.refreshToken, ttlSeconds: result.ttlSeconds, persistent: result.persistent }
        : null, // grace branch: another tab already rotated; its cookie wins
  }
}

function apply(res: NextResponse, out: Extract<Outcome, { ok: true }>) {
  setAccessCookie(res, out.accessToken)
  if (out.rotated) {
    setSessionCookie(res, out.rotated.token, out.rotated.persistent ? out.rotated.ttlSeconds : null)
  }
}

// XHR/fetch refresh (used by lib/auth-fetch.ts)
export async function POST(req: NextRequest) {
  const out = await refresh(req)
  if (!out.ok) {
    const res = NextResponse.json({ error: 'Session expired' }, { status: out.status })
    if (out.clear) clearAuthCookies(res)
    return res
  }
  const res = NextResponse.json({ ok: true })
  apply(res, out)
  return res
}

// Navigation refresh (used by middleware for full page loads with an expired access cookie)
export async function GET(req: NextRequest) {
  const next = safeNextPath(req.nextUrl.searchParams.get('next'))
  const out = await refresh(req)

  if (!out.ok) {
    const url = new URL('/auth/login', req.url)
    url.searchParams.set('reason', 'expired')
    if (next !== '/') url.searchParams.set('next', next)
    const res = NextResponse.redirect(url)
    if (out.clear) clearAuthCookies(res)
    return res
  }

  const res = NextResponse.redirect(new URL(next, req.url))
  apply(res, out)
  return res
}