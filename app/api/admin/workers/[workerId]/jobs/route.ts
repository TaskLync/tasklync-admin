// app/api/admin/workers/[workerId]/jobs/route.ts
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
      `SELECT b.id, b.status, b.estimated_total AS amount, b.scheduled_at, b.created_at,
              u.name AS customer_name, c.name AS category
       FROM bookings b
       LEFT JOIN users u ON u.id = b.user_id
       LEFT JOIN categories c ON c.id = b.category_id
       WHERE b.worker_id = $1
       ORDER BY b.created_at DESC
       LIMIT 50`,
      [workerId]
    )
    return NextResponse.json({
      available: true,
      data: rows.map((r) => ({
        id: r.id,
        customerName: r.customer_name,
        category: r.category,
        status: r.status,
        amount: r.amount !== null ? Number(r.amount) : null,
        scheduledAt: r.scheduled_at,
        createdAt: r.created_at,
      })),
    })
  } catch (err: any) {
    if (err?.code === '42P01' || err?.code === '42703') {
      return NextResponse.json({ available: false, data: [] })
    }
    console.error('[GET worker jobs]', err)
    return NextResponse.json({ error: 'Failed to load job history' }, { status: 500 })
  }
}