import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermission('dashboard:view')
  if (!guard.ok) return guard.response

  try {
    const result = await db.query(
      `SELECT id, event_type, message, metadata, created_at
       FROM platform_events
       ORDER BY created_at DESC
       LIMIT 50`
    )
    return NextResponse.json(result.rows)
  } catch (err) {
    console.error('[dashboard/activity]', err)
    return NextResponse.json({ error: 'Failed to load activity feed' }, { status: 500 })
  }
}