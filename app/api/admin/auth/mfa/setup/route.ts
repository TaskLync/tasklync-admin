export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessToken } from '@/lib/auth/jwt'
import { generateMfaSecret, generateMfaQrCode } from '@/lib/auth/mfa'
import { redis } from '@/lib/redis'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await verifyAccessToken(auth).catch(() => null)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const secret = generateMfaSecret()
  const qrCodeDataUrl = await generateMfaQrCode(payload.email, secret)

  // Stash the pending secret for 10 minutes — only committed to admin_users on confirm
  await redis.set(`admin:mfa_pending:${payload.sub}`, secret, 'EX', 600)

  return NextResponse.json({ qrCodeDataUrl, secret }) // secret shown as manual-entry fallback
}