export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { rotateSession, getSession } from '@/lib/auth/session'
import { signAccessToken } from '@/lib/auth/jwt'

export async function POST(req: NextRequest) {
  const oldRefreshToken = req.cookies.get('admin_session')?.value
  if (!oldRefreshToken) return NextResponse.json({ error: 'No session' }, { status: 401 })

  const existing = await getSession(oldRefreshToken)
  if (!existing) return NextResponse.json({ error: 'Session expired' }, { status: 401 })

  const newRefreshToken = await rotateSession(oldRefreshToken)
  if (!newRefreshToken) return NextResponse.json({ error: 'Session expired' }, { status: 401 })

  const accessToken = await signAccessToken({
    sub: existing.adminId, email: existing.email, role: existing.role, sessionId: newRefreshToken,
  })

  const res = NextResponse.json({ accessToken })
  res.cookies.set('admin_session', newRefreshToken, {
    httpOnly: true, secure: true, sameSite: 'strict', path: '/',
    maxAge: Number(process.env.ADMIN_REFRESH_TOKEN_TTL ?? 28800),
  })
  return res
}