// app/api/admin/workers/filter-options/route.ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'

export async function GET() {
  const guard = await requirePermission('workers:view')
  if (!guard.ok) return guard.response

  try {
    const { rows } = await db.query(
      `SELECT id, name FROM categories WHERE is_active = true ORDER BY sort_order, name`
    )
    return NextResponse.json({
      categories: rows.map((r) => ({ id: r.id, name: r.name })),
    })
  } catch (err) {
    console.error('[GET /api/admin/workers/filter-options]', err)
    return NextResponse.json({ error: 'Failed to load filter options' }, { status: 500 })
  }
}