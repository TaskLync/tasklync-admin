export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { destroySession, getSession } from '@/lib/auth/session'
import { logAdminAction } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const refreshToken = req.cookies.get('admin_session')?.value

  if (refreshToken) {
    const session = await getSession(refreshToken)
    await destroySession(refreshToken)
    if (session) {
      await logAdminAction({ adminId: session.adminId, adminEmail: session.email, action: 'auth.logout', ip })
    }
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.delete('admin_session')
  return res
}