// app/api/admin/users/[userId]/reviews/route.ts
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
      `SELECT r.id, r.rating, r.comment, r.is_flagged, r.created_at,
              w.name AS worker_name
       FROM reviews r
       LEFT JOIN workers w ON w.id = r.worker_id
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC
       LIMIT 50`,
      [userId]
    )
    return NextResponse.json({
      available: true,
      data: rows.map((r) => ({
        id: r.id,
        workerName: r.worker_name,
        rating: r.rating,
        comment: r.comment,
        isFlagged: r.is_flagged,
        createdAt: r.created_at,
      })),
    })
  } catch (err: any) {
    if (err?.code === '42P01') {
      return NextResponse.json({ available: false, data: [] })
    }
    console.error('[GET user reviews]', err)
    return NextResponse.json({ error: 'Failed to load reviews' }, { status: 500 })
  }
}