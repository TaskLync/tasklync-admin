// app/api/admin/workers/[workerId]/catalog/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { isUuid, workerNotFound } from '@/lib/workers-api'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workerId: string }> }
) {
  const guard = await requirePermission('workers:view')
  if (!guard.ok) return guard.response

  const { workerId } = await params
  if (!isUuid(workerId)) return workerNotFound()

  try {
    const [skillsRes, offeringsRes] = await Promise.all([
      db.query(
        `SELECT ws.id, ws.category_id, ws.years_exp, ws.is_verified, c.name AS category_name
         FROM worker_skills ws
         LEFT JOIN categories c ON c.id = ws.category_id
         WHERE ws.worker_id = $1
         ORDER BY c.sort_order, c.name`,
        [workerId]
      ),
      db.query(
        `SELECT o.id, o.is_custom, o.custom_price, o.price_type, o.is_active,
                COALESCE(s.name, o.custom_name) AS name
         FROM worker_service_offerings o
         LEFT JOIN services s ON s.id = o.service_id
         WHERE o.worker_id = $1
         ORDER BY o.created_at DESC`,
        [workerId]
      ),
    ])

    return NextResponse.json({
      skills: skillsRes.rows.map((r) => ({
        id: r.id,
        categoryId: r.category_id,
        categoryName: r.category_name,
        yearsExp: r.years_exp ?? 0,
        isVerified: r.is_verified,
      })),
      offerings: offeringsRes.rows.map((r) => ({
        id: r.id,
        name: r.name,
        isCustom: r.is_custom,
        customPrice: Number(r.custom_price),
        priceType: r.price_type,
        isActive: r.is_active,
      })),
    })
  } catch (err) {
    console.error('[GET worker catalog]', err)
    return NextResponse.json({ error: 'Failed to load skills and services' }, { status: 500 })
  }
}