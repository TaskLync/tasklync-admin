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
    `SELECT id, category_id, name, name_ur, description, base_price, price_type,
            min_duration_mins, icon_url, is_active, sort_order, created_at
     FROM services WHERE category_id = $1 ORDER BY sort_order ASC, name ASC`,
    [categoryId]
  )

  const data = rows.map((r) => ({
    id: r.id, categoryId: r.category_id, name: r.name, nameUr: r.name_ur,
    description: r.description, basePrice: r.base_price !== null ? Number(r.base_price) : null,
    priceType: r.price_type, minDurationMins: r.min_duration_mins, iconUrl: r.icon_url,
    isActive: r.is_active, sortOrder: r.sort_order, createdAt: r.created_at,
  }))
  return NextResponse.json(data)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  const guard = await requirePermission('services:edit')
  if (!guard.ok) return guard.response

  const { categoryId } = await params
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

  const catCheck = await db.query('SELECT id FROM categories WHERE id = $1', [categoryId])
  if (catCheck.rows.length === 0) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 })
  }

  const { rows } = await db.query(
    `INSERT INTO services (category_id, name, name_ur, description, base_price, price_type, min_duration_mins, icon_url, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, category_id, name, name_ur, description, base_price, price_type, min_duration_mins, icon_url, is_active, sort_order, created_at`,
    [
      categoryId, name, body.nameUr ?? null, body.description ?? null,
      priceType === 'quote' ? null : body.basePrice,
      priceType, body.minDurationMins ?? 30, body.iconUrl ?? null, body.sortOrder ?? 0,
    ]
  )

  await logAdminAction({
    adminId: guard.admin.adminId,
    adminEmail: guard.admin.adminEmail,
    action: 'service.created',
    resourceType: 'service',
    resourceId: rows[0].id,
    newValue: { categoryId, name, basePrice: body.basePrice, priceType },
    ip: getClientIp(req),
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ data: rows[0] }, { status: 201 })
}