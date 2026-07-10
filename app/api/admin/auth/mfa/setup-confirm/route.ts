export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { verifyAccessToken } from '@/lib/auth/jwt'
import { verifyTotp, generateBackupCodes, hashBackupCodes } from '@/lib/auth/mfa'
import { redis } from '@/lib/redis'
import { logAdminAction } from '@/lib/audit'

const schema = z.object({ code: z.string().min(6) })

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const auth = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyAccessToken(auth).catch(() => null)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = schema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: 'Invalid code' }, { status: 400 })

  const pendingSecret = await redis.get(`admin:mfa_pending:${payload.sub}`)
  if (!pendingSecret) {
    return NextResponse.json({ error: 'Setup session expired, start again' }, { status: 400 })
  }

  if (!verifyTotp(body.data.code, pendingSecret)) {
    return NextResponse.json({ error: 'Incorrect code' }, { status: 400 })
  }

  await db.query('UPDATE admin_users SET mfa_secret = $1, mfa_enabled = TRUE WHERE id = $2', [
    pendingSecret, payload.sub,
  ])
  await redis.del(`admin:mfa_pending:${payload.sub}`)

  const backupCodes = generateBackupCodes(10)
  const hashes = await hashBackupCodes(backupCodes)
  await db.query('DELETE FROM admin_mfa_backup_codes WHERE admin_id = $1', [payload.sub])
  for (const hash of hashes) {
    await db.query('INSERT INTO admin_mfa_backup_codes (admin_id, code_hash) VALUES ($1, $2)', [
      payload.sub, hash,
    ])
  }

  await logAdminAction({ adminId: payload.sub, adminEmail: payload.email, action: 'auth.mfa_enabled', ip })

  // Backup codes are shown to the admin exactly once — plaintext, never stored, never logged
  return NextResponse.json({ backupCodes })
}