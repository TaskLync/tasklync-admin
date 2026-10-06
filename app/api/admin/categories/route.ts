import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'

const SORT_COLUMNS: Record<string, string> = {
  sort_order: 'c.sort_order',
  name: 'c.name',
  active_workers: 'active_worker_count',
}

const ID_SLUG_RE = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/

export async function GET(req: NextRequest) {
  const guard = await requirePermission('categories:view')
  if (!guard.ok) return guard.response

  const sp = req.nextUrl.searchParams
  const search = (sp.get('search') || '').trim()
  const status = sp.get('status') || 'all'
  const sortBy = SORT_COLUMNS[sp.get('sortBy') || 'sort_order'] || 'c.sort_order'
  const sortDir = sp.get('sortDir') === 'desc' ? 'DESC' : 'ASC'
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '20', 10)))
  const offset = (page - 1) * pageSize

  const where: string[] = []
  const params: any[] = []
  let i = 1

  if (search) {
    params.push(`%${search}%`)
    where.push(`(c.name ILIKE $${i} OR c.name_ur ILIKE $${i} OR c.id ILIKE $${i})`)
    i++
  }
  if (status !== 'all') {
    params.push(status === 'active')
    where.push(`c.is_active = $${i}`)
    i++
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  // active_worker_count / service_count computed per category via correlated subqueries
  const listSql = `
    SELECT
      c.id, c.name, c.name_ur, c.icon_url, c.parent_id, c.is_active, c.sort_order, c.created_at,
      (SELECT count(*)::int FROM services s WHERE s.category_id = c.id) AS service_count,
      (SELECT count(DISTINCT ws.worker_id)::int
       FROM worker_skills ws
       JOIN workers w ON w.id = ws.worker_id
       WHERE ws.category_id = c.id AND w.verification_status = 'VERIFIED' AND w.is_active = true
      ) AS active_worker_count
    FROM categories c
    ${whereSql}
    ORDER BY ${sortBy} ${sortDir}
    LIMIT $${i} OFFSET $${i + 1}
  `
  const countSql = `SELECT count(*)::int AS total FROM categories c ${whereSql}`
  const listParams = [...params, pageSize, offset]

  try {
    const [listRes, countRes] = await Promise.all([
      db.query(listSql, listParams),
      db.query(countSql, params),
    ])

    const data = listRes.rows.map((r) => ({
      id: r.id,
      name: r.name,
      nameUr: r.name_ur,
      iconUrl: r.icon_url,
      parentId: r.parent_id,
      isActive: r.is_active,
      sortOrder: r.sort_order,
      serviceCount: r.service_count,
      activeWorkerCount: r.active_worker_count,
      createdAt: r.created_at,
    }))
    const total = countRes.rows[0]?.total ?? 0

    return NextResponse.json({
      data, page, pageSize, total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    })
  } catch (err) {
    console.error('[GET /api/admin/categories]', err)
    return NextResponse.json({ error: 'Failed to load categories' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const guard = await requirePermission('categories:create')
  if (!guard.ok) return guard.response

  const body = await req.json().catch(() => ({}))
  const id: string = (body.id || '').trim().toLowerCase()
  const name: string = (body.name || '').trim()

  if (!ID_SLUG_RE.test(id)) {
    return NextResponse.json(
      { error: 'Category ID must be 3–50 lowercase letters, numbers, or hyphens (e.g. "ac-repair")' },
      { status: 400 }
    )
  }
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO categories (id, name, name_ur, icon_url, parent_id, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, name_ur, icon_url, parent_id, is_active, sort_order, created_at`,
      [id, name, body.nameUr ?? null, body.iconUrl ?? null, body.parentId ?? null, body.sortOrder ?? 0]
    )

    await logAdminAction({
      adminId: guard.admin.adminId,
      adminEmail: guard.admin.adminEmail,
      action: 'category.created',
      resourceType: 'category',
      resourceId: id,
      newValue: { name, nameUr: body.nameUr ?? null },
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    return NextResponse.json({ data: rows[0] }, { status: 201 })
  } catch (err: any) {
    if (err.code === '23505') {
      return NextResponse.json({ error: `Category ID "${id}" already exists` }, { status: 409 })
    }
    console.error('[POST /api/admin/categories]', err)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}