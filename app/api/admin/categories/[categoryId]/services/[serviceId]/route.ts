import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ categoryId: string; serviceId: string }> }
) {
  const guard = await requirePermission('services:edit')
  if (!guard.ok) return guard.response

  const { categoryId, serviceId } = await params
  const body = await req.json().catch(() => ({}))
  const name: string = (body.name || '').trim()
  const priceType: string = body.priceType || 'fixed'

  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (!['fixed', 'hourly', 'quote'].includes(priceType)) {
    return NextResponse.json({ error: 'priceType must be fixed, hourly, or quote' }, { status: 400 })
  }
  if (priceType !== 'quote' && (body.basePrice === null || body.basePrice === undefined || body.basePrice < 0)) {
    return NextResponse.json({ error: 'A non-negative base price is required unless priceType is "quote"' }, { status: 400 })
  }

  const { rows } = await db.query(
    `UPDATE services
     SET name = $3, name_ur = $4, description = $5, base_price = $6, price_type = $7,
         min_duration_mins = $8, icon_url = $9, sort_order = $10, updated_at = NOW()
     WHERE id = $1 AND category_id = $2
     RETURNING id, category_id, name, name_ur, description, base_price, price_type, min_duration_mins, icon_url, is_active, sort_order`,
    [
      serviceId, categoryId, name, body.nameUr ?? null, body.description ?? null,
      priceType === 'quote' ? null : body.basePrice,
      priceType, body.minDurationMins ?? 30, body.iconUrl ?? null, body.sortOrder ?? 0,
    ]
  )
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Service not found in this category' }, { status: 404 })
  }

  await logAdminAction({
    adminId: guard.admin.adminId,
    adminEmail: guard.admin.adminEmail,
    action: 'service.updated',
    resourceType: 'service',
    resourceId: serviceId,
    newValue: body,
    ip: getClientIp(req),
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ data: rows[0] })
}