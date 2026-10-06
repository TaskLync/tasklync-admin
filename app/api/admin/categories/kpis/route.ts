import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'

export async function GET() {
  const guard = await requirePermission('categories:view')
  if (!guard.ok) return guard.response

  try {
    const { rows } = await db.query(`
      SELECT
        (SELECT count(*)::int FROM categories) AS total_categories,
        (SELECT count(*)::int FROM categories WHERE is_active = true) AS active_categories,
        (SELECT count(*)::int FROM services) AS total_services,
        (SELECT count(*)::int FROM categories c WHERE c.is_active = true AND NOT EXISTS (
          SELECT 1 FROM worker_skills ws
          JOIN workers w ON w.id = ws.worker_id
          WHERE ws.category_id = c.id AND w.verification_status = 'VERIFIED' AND w.is_active = true
        )) AS categories_with_no_active_workers
    `)

    const r = rows[0]
    return NextResponse.json({
      totalCategories: r.total_categories,
      activeCategories: r.active_categories,
      totalServices: r.total_services,
      categoriesWithNoActiveWorkers: r.categories_with_no_active_workers,
    })
  } catch (err) {
    console.error('[GET /api/admin/categories/kpis]', err)
    return NextResponse.json({ error: 'Failed to load category KPIs' }, { status: 500 })
  }
}