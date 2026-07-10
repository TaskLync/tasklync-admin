// app/api/admin/users/[userId]/bookings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const guard = await requirePermission('users:view')
  if (!guard.ok) return guard.response

  const { userId } = await params

  try {
    const { rows } = await db.query(
      `SELECT b.id, b.status, b.estimated_total AS amount, b.scheduled_at, b.created_at,
              w.name AS worker_name, c.name AS category
       FROM bookings b
       LEFT JOIN workers w ON w.id = b.worker_id
       LEFT JOIN categories c ON c.id = b.category_id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC
       LIMIT 50`,
      [userId]
    )
    return NextResponse.json({
      available: true,
      data: rows.map((r) => ({
        id: r.id,
        workerName: r.worker_name,
        category: r.category,
        status: r.status,
        amount: r.amount,
        scheduledAt: r.scheduled_at,
        createdAt: r.created_at,
      })),
    })
  } catch (err: any) {
    if (err?.code === '42P01' || err?.code === '42703') {
      return NextResponse.json({ available: false, data: [] })
    }
    console.error('[GET user bookings]', err)
    return NextResponse.json({ error: 'Failed to load bookings' }, { status: 500 })
  }
}