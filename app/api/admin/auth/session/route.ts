export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateAccessToken } from '@/lib/auth/request'
import { COOKIE } from '@/lib/auth/cookies'

export async function GET(req: NextRequest) {
  const payload = await authenticateAccessToken(req.cookies.get(COOKIE.access)?.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rows } = await db.query(
    'SELECT id, email, full_name, role, mfa_enabled, is_active FROM admin_users WHERE id = $1',
    [payload.sub]
  )
  const a = rows[0]
  if (!a || !a.is_active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json({
    id: a.id,
    email: a.email,
    fullName: a.full_name,
    role: a.role,
    mfaEnabled: a.mfa_enabled,
    isActive: a.is_active,
    mfaSetupRequired: payload.scope === 'mfa_setup',
  })
}