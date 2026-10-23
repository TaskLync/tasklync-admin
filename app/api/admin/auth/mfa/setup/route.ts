export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { redis } from '@/lib/redis'
import { authenticateAccessToken } from '@/lib/auth/request'
import { generateMfaSecret, generateMfaQrCode } from '@/lib/auth/mfa'
import { COOKIE } from '@/lib/auth/cookies'
import { hit } from '@/lib/auth/rate-limit'

export async function POST(req: NextRequest) {
  const payload = await authenticateAccessToken(req.cookies.get(COOKIE.access)?.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = await hit(`mfa-setup:${payload.sub}`, 10, 3600)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
  }

  const { rows } = await db.query('SELECT is_active, mfa_enabled FROM admin_users WHERE id = $1', [payload.sub])
  if (!rows[0] || !rows[0].is_active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // A stolen session must not be able to swap the authenticator on an enrolled account.
  if (rows[0].mfa_enabled) {
    return NextResponse.json({ error: 'Two factor authentication is already enabled.' }, { status: 409 })
  }

  const secret = generateMfaSecret()
  const qrCodeDataUrl = await generateMfaQrCode(payload.email, secret)

  // Pending secret is only committed to admin_users on confirm.
  await redis.set(`admin:mfa_pending:${payload.sub}`, secret, 'EX', 600)

  return NextResponse.json({ qrCodeDataUrl, secret }) // secret = manual-entry fallback
}