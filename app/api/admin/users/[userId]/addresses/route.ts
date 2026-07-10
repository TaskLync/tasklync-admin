// app/api/admin/users/[userId]/addresses/route.ts
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
      `SELECT id, label, address_line, city, country, is_default, created_at
       FROM user_addresses WHERE user_id = $1
       ORDER BY is_default DESC, created_at DESC`,
      [userId]
    )
    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        label: r.label,
        addressLine: r.address_line,
        city: r.city,
        country: r.country,
        isDefault: r.is_default,
        createdAt: r.created_at,
      }))
    )
  } catch (err) {
    console.error('[GET addresses]', err)
    return NextResponse.json({ error: 'Failed to load addresses' }, { status: 500 })
  }
}