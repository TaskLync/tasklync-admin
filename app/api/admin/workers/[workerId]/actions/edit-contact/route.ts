// app/api/admin/workers/[workerId]/actions/edit-contact/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { isUuid, workerNotFound } from '@/lib/workers-api'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ workerId: string }> }
) {
  const guard = await requirePermission('workers:edit')
  if (!guard.ok) return guard.response

  const { workerId } = await params
  if (!isUuid(workerId)) return workerNotFound()

  const body = await req.json().catch(() => ({}))
  const phone: string | undefined = body.phone?.trim()
  const email: string | undefined = body.email?.trim()

  if (!phone && !email) {
    return NextResponse.json({ error: 'Provide a phone and/or email to update' }, { status: 400 })
  }

  const { rows: before } = await db.query(
    `SELECT phone, email FROM workers WHERE id = $1 AND deleted_at IS NULL`,
    [workerId]
  )
  if (before.length === 0) return workerNotFound()

  const sets: string[] = []
  const values: unknown[] = [workerId]

  if (phone) {
    values.push(phone)
    sets.push(`phone = $${values.length}`)
  }
  if (email) {
    values.push(email)
    sets.push(`email = $${values.length}`)
  }
  sets.push('updated_at = now()')

  try {
    await db.query(`UPDATE workers SET ${sets.join(', ')} WHERE id = $1`, values)
  } catch (err: any) {
    if (err?.code === '23505') {
      return NextResponse.json({ error: 'That phone or email is already in use' }, { status: 409 })
    }
    throw err
  }

  await logAdminAction({
    adminId: guard.admin.adminId,
    adminEmail: guard.admin.adminEmail,
    action: 'worker.contact_edited',
    resourceType: 'worker',
    resourceId: workerId,
    oldValue: before[0],
    newValue: {
      phone: phone ?? before[0].phone,
      email: email ?? before[0].email,
    },
    ip: getClientIp(req),
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ ok: true })
}