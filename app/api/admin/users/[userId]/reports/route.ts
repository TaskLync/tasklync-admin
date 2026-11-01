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
      `SELECT d.id, d.reason, d.status::text AS status, d.created_at, w.name AS counterparty_name
         FROM disputes d
         LEFT JOIN workers w ON w.id = d.raised_against
        WHERE d.raised_by = $1
        ORDER BY d.created_at DESC
        LIMIT 50`,
      [userId]
    )
    return NextResponse.json({
      available: true,
      data: rows.map((r) => ({
        id: r.id,
        direction: 'filed_by_user' as const,
        counterpartyName: r.counterparty_name,
        reason: r.reason,
        status: r.status,
        createdAt: r.created_at,
      })),
    })
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code
    if (code === '42P01') return NextResponse.json({ available: false, data: [] })
    console.error('[GET user reports]', err)
    return NextResponse.json({ error: 'Failed to load reports' }, { status: 500 })
  }
}