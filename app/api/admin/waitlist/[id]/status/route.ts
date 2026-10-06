// app/api/admin/waitlist/[id]/status/route.ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'

const VALID_STATUSES = ['pending', 'invited', 'converted']

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePermission('waitlist:manage')
  if (!guard.ok) return guard.response

  const { id } = await params

  const body = await request.json().catch(() => null)
  const status = body?.status

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status value' }, { status: 400 })
  }

  try {
    const existing = await db.query(
      'SELECT status FROM waitlist WHERE id = $1',
      [id]
    )

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    const result = await db.query(
      'UPDATE waitlist SET status = $1, updated_at = now() WHERE id = $2 RETURNING *',
      [status, id]
    )

    await logAdminAction({
      adminId: guard.admin.adminId,
      adminEmail: guard.admin.adminEmail,
      action: 'waitlist.status_updated',
      resourceType: 'waitlist',
      resourceId: id,
      oldValue: { status: existing.rows[0].status },
      newValue: { status },
      ip: getClientIp(request),
      userAgent: request.headers.get('user-agent') ?? undefined,
    })

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('[waitlist/status]', error)
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }
}