import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ categoryId: string; serviceId: string }> }
) {
  const guard = await requirePermission('services:edit')
  if (!guard.ok) return guard.response

  const { categoryId, serviceId } = await params
  const body = await req.json().catch(() => ({}))
  const isActive: boolean = Boolean(body.isActive)

  const { rows } = await db.query(
    `UPDATE services SET is_active = $3, updated_at = NOW()
     WHERE id = $1 AND category_id = $2 RETURNING id, is_active`,
    [serviceId, categoryId, isActive]
  )
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Service not found in this category' }, { status: 404 })
  }

  await logAdminAction({
    adminId: guard.admin.adminId,
    adminEmail: guard.admin.adminEmail,
    action: isActive ? 'service.activated' : 'service.deactivated',
    resourceType: 'service',
    resourceId: serviceId,
    newValue: { isActive },
    ip: getClientIp(req),
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ ok: true, isActive })
}