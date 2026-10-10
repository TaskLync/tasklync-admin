// app/api/admin/workers/[workerId]/reviews/route.ts
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
    const { rows } = await db.query(
      `SELECT r.id, r.rating, r.comment, r.is_flagged, r.created_at,
              u.name AS customer_name
       FROM reviews r
       LEFT JOIN users u ON u.id = r.user_id
       WHERE r.worker_id = $1
       ORDER BY r.created_at DESC
       LIMIT 50`,
      [workerId]
    )
    return NextResponse.json({
      available: true,
      data: rows.map((r) => ({
        id: r.id,
        customerName: r.customer_name,
        rating: r.rating,
        comment: r.comment,
        isFlagged: r.is_flagged,
        createdAt: r.created_at,
      })),
    })
  } catch (err: any) {
    if (err?.code === '42P01' || err?.code === '42703') {
      return NextResponse.json({ available: false, data: [] })
    }
    console.error('[GET worker reviews]', err)
    return NextResponse.json({ error: 'Failed to load reviews' }, { status: 500 })
  }
}