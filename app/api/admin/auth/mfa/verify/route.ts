export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { verifyMfaTempToken, signAccessToken } from '@/lib/auth/jwt'
import { verifyTotp, verifyBackupCode } from '@/lib/auth/mfa'
import { createSession } from '@/lib/auth/session'
import { logAdminAction } from '@/lib/audit'
import { setAuthCookies } from '@/lib/auth/cookies'

const schema = z.object({
  tempToken: z.string(),
  code: z.string().min(6),
})

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const body = schema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  let adminId: string
  try {
    const payload = await verifyMfaTempToken(body.data.tempToken)
    adminId = payload.sub
  } catch {
    return NextResponse.json({ error: 'MFA session expired, please log in again' }, { status: 401 })
  }

  const { rows } = await db.query('SELECT * FROM admin_users WHERE id = $1', [adminId])
  const admin = rows[0]
  if (!admin) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  const totpValid = admin.mfa_secret ? verifyTotp(body.data.code, admin.mfa_secret) : false

  let usedBackupCode = false
  if (!totpValid) {
    const { rows: backupRows } = await db.query(
      'SELECT id, code_hash FROM admin_mfa_backup_codes WHERE admin_id = $1 AND used_at IS NULL',
      [adminId]
    )
    const idx = await verifyBackupCode(body.data.code, backupRows.map((r) => r.code_hash))
    if (idx === -1) {
      await logAdminAction({ adminId, adminEmail: admin.email, action: 'auth.mfa_failed', ip })
      return NextResponse.json({ error: 'Invalid code' }, { status: 401 })
    }
    usedBackupCode = true
    await db.query('UPDATE admin_mfa_backup_codes SET used_at = NOW() WHERE id = $1', [backupRows[idx].id])
  }

  const refreshToken = await createSession(admin.id, admin.email, admin.role, ip)
  const accessToken = await signAccessToken({
    sub: admin.id, email: admin.email, role: admin.role, sessionId: refreshToken,
  })

  await logAdminAction({
    adminId: admin.id, adminEmail: admin.email, ip,
    action: usedBackupCode ? 'auth.mfa_success_backup_code' : 'auth.mfa_success',
  })

  const res = NextResponse.json({
    accessToken,
    admin: { id: admin.id, email: admin.email, fullName: admin.full_name, role: admin.role, mfaEnabled: true },
  })
  setAuthCookies(res, accessToken, refreshToken)
  return res
}