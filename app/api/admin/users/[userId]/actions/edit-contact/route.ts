// app/api/admin/users/[userId]/actions/edit-contact/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const guard = await requirePermission('users:edit')
  if (!guard.ok) return guard.response

  const body = await req.json().catch(() => ({}))
  const phone: string | undefined = body.phone?.trim()
  const email: string | undefined = body.email?.trim()

  if (!phone && !email) {
    return NextResponse.json({ error: 'Provide a phone and/or email to update' }, { status: 400 })
  }

  const { rows: before } = await db.query(
    `SELECT phone, email FROM users WHERE id = $1`,
    [params.userId]
  )
  if (before.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const sets: string[] = []
  const values: any[] = [params.userId]
  let i = 2
  if (phone) { sets.push(`phone = $${i}`); values.push(phone); i++ }
  if (email) { sets.push(`email = $${i}`); values.push(email); i++ }
  sets.push('updated_at = now()')

  try {
    await db.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $1`, values)
  } catch (err: any) {
    if (err?.code === '23505') {
      return NextResponse.json({ error: 'That phone or email is already in use' }, { status: 409 })
    }
    throw err
  }

  await logAdminAction({
    adminId: guard.admin.adminId,
    adminEmail: guard.admin.adminEmail,
    action: 'user.contact_edited',
    resourceType: 'user',
    resourceId: params.userId,
    oldValue: before[0],
    newValue: { phone: phone ?? before[0].phone, email: email ?? before[0].email },
    ip: getClientIp(req),
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ ok: true })
}