import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  const guard = await requirePermission('categories:view')
  if (!guard.ok) return guard.response

  const { categoryId } = await params

  const { rows } = await db.query(
    `SELECT
       c.id, c.name, c.name_ur, c.icon_url, c.parent_id, c.is_active, c.sort_order, c.created_at,
       (SELECT count(*)::int FROM services s WHERE s.category_id = c.id) AS service_count,
       (SELECT count(DISTINCT ws.worker_id)::int
        FROM worker_skills ws JOIN workers w ON w.id = ws.worker_id
        WHERE ws.category_id = c.id AND w.verification_status = 'VERIFIED' AND w.is_active = true
       ) AS active_worker_count
     FROM categories c WHERE c.id = $1`,
    [categoryId]
  )
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 })
  }
  const r = rows[0]
  return NextResponse.json({
    id: r.id, name: r.name, nameUr: r.name_ur, iconUrl: r.icon_url, parentId: r.parent_id,
    isActive: r.is_active, sortOrder: r.sort_order, createdAt: r.created_at,
    serviceCount: r.service_count, activeWorkerCount: r.active_worker_count,
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  const guard = await requirePermission('categories:edit')
  if (!guard.ok) return guard.response

  const { categoryId } = await params
  const body = await req.json().catch(() => ({}))
  const name: string = (body.name || '').trim()
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const { rows } = await db.query(
    `UPDATE categories
     SET name = $2, name_ur = $3, icon_url = $4, parent_id = $5, sort_order = $6, updated_at = NOW()
     WHERE id = $1
     RETURNING id, name, name_ur, icon_url, parent_id, is_active, sort_order`,
    [categoryId, name, body.nameUr ?? null, body.iconUrl ?? null, body.parentId ?? null, body.sortOrder ?? 0]
  )
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 })
  }

  await logAdminAction({
    adminId: guard.admin.adminId,
    adminEmail: guard.admin.adminEmail,
    action: 'category.updated',
    resourceType: 'category',
    resourceId: categoryId,
    newValue: body,
    ip: getClientIp(req),
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ data: rows[0] })
}