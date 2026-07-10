// app/api/admin/users/[userId]/reports/route.ts
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
      `SELECT rp.id, rp.reason, rp.status, rp.created_at,
              CASE WHEN rp.reporter_id = $1 THEN 'filed_by_user' ELSE 'filed_against_user' END AS direction,
              w.name AS counterparty_name
       FROM reports rp
       LEFT JOIN workers w
         ON w.id = CASE WHEN rp.reporter_id = $1 THEN rp.reported_id ELSE rp.reporter_id END
       WHERE rp.reporter_id = $1 OR rp.reported_id = $1
       ORDER BY rp.created_at DESC
       LIMIT 50`,
      [userId]
    )
    return NextResponse.json({
      available: true,
      data: rows.map((r) => ({
        id: r.id,
        direction: r.direction,
        counterpartyName: r.counterparty_name,
        reason: r.reason,
        status: r.status,
        createdAt: r.created_at,
      })),
    })
  } catch (err: any) {
    if (err?.code === '42P01') {
      return NextResponse.json({ available: false, data: [] })
    }
    console.error('[GET user reports]', err)
    return NextResponse.json({ error: 'Failed to load reports' }, { status: 500 })
  }
}