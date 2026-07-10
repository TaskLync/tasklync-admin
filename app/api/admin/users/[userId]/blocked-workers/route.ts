// app/api/admin/users/[userId]/blocked-workers/route.ts
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
      `SELECT b.id, b.blocked_worker_id, b.created_at,
              w.name AS worker_name, w.phone AS worker_phone, w.category AS worker_category
       FROM user_blocks b
       LEFT JOIN workers w ON w.id = b.blocked_worker_id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
      [userId]
    )
    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        blockedWorkerId: r.blocked_worker_id,
        workerName: r.worker_name,
        workerPhone: r.worker_phone,
        workerCategory: r.worker_category,
        createdAt: r.created_at,
      }))
    )
  } catch (err: any) {
    if (err?.code === '42P01' || err?.code === '42703') {
      return NextResponse.json([])
    }
    console.error('[GET blocked-workers]', err)
    return NextResponse.json({ error: 'Failed to load blocked workers' }, { status: 500 })
  }
}