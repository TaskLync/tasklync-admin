import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  const guard = await requirePermission('categories:edit')
  if (!guard.ok) return guard.response

  const { categoryId } = await params
  const body = await req.json().catch(() => ({}))
  const isActive: boolean = Boolean(body.isActive)

  const { rows } = await db.query(
    `UPDATE categories SET is_active = $2, updated_at = NOW() WHERE id = $1 RETURNING id, is_active`,
    [categoryId, isActive]
  )
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 })
  }

  await logAdminAction({
    adminId: guard.admin.adminId,
    adminEmail: guard.admin.adminEmail,
    action: isActive ? 'category.activated' : 'category.deactivated',
    resourceType: 'category',
    resourceId: categoryId,
    newValue: { isActive },
    ip: getClientIp(req),
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ ok: true, isActive })
}