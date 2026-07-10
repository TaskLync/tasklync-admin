import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermission('dashboard:view')
  if (!guard.ok) return guard.response

  try {
    const result = await db.query('SELECT get_needs_attention() AS data')
    return NextResponse.json(result.rows[0].data)
  } catch (err) {
    console.error('[dashboard/attention]', err)
    return NextResponse.json({ error: 'Failed to load attention items' }, { status: 500 })
  }
}