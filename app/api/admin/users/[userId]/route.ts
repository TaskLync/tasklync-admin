// app/api/admin/users/[userId]/route.ts
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
      `SELECT * FROM get_user_overview($1)`,
      [userId]
    )
    if (rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const r = rows[0]
    return NextResponse.json({
      id: r.id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      avatarUrl: r.avatar_url,
      preferredLanguage: r.preferred_language,
      preferredCurrency: r.preferred_currency,
      totalBookings: r.total_bookings,
      isActive: r.is_active,
      role: r.role,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      deletedAt: r.deleted_at,
      pushEnabled: r.push_enabled,
      emailEnabled: r.email_enabled,
      suspendedUntil: r.suspended_until,
      suspendedReason: r.suspended_reason,
      bannedAt: r.banned_at,
      bannedReason: r.banned_reason,
      warningCount: r.warning_count,
      lastWarningAt: r.last_warning_at,
      lastWarningReason: r.last_warning_reason,
      defaultCity: r.default_city,
      addressCount: Number(r.address_count),
      blockedWorkerCount: Number(r.blocked_worker_count),
    })
  } catch (err) {
    console.error('[GET /api/admin/users/[userId]]', err)
    return NextResponse.json({ error: 'Failed to load user' }, { status: 500 })
  }
}