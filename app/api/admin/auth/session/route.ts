export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessToken } from '@/lib/auth/jwt'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await verifyAccessToken(auth).catch(() => null)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rows } = await db.query(
    'SELECT id, email, full_name, role, mfa_enabled FROM admin_users WHERE id = $1',
    [payload.sub]
  )
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const a = rows[0]
  return NextResponse.json({
    id: a.id, email: a.email, fullName: a.full_name, role: a.role, mfaEnabled: a.mfa_enabled,
  })
}