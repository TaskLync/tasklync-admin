import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { couponSvc } from '@/lib/services/booking'
import { serviceErrorResponse } from '@/lib/internal-client'
import { ACTIONS, isAction, mapCoupon } from '@/lib/coupons-api'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ couponId: string; action: string }> }) {
  const { couponId, action } = await params
  if (!isAction(action)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const guard = await requirePermission(ACTIONS[action])
  if (!guard.ok) return guard.response

  const body = await req.json().catch(() => ({}))
  const reason = String(body.reason ?? '').trim()
  const endsAt = body.endsAt ? String(body.endsAt) : undefined
  if (['pause', 'end', 'reject'].includes(action) && reason.length < 3) {
    return NextResponse.json({ error: 'A reason is required' }, { status: 400 })
  }
  if (action === 'extend' && (!endsAt || Number.isNaN(Date.parse(endsAt)))) {
    return NextResponse.json({ error: 'Choose a new end date' }, { status: 400 })
  }

  const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }
  try {
    const row = await couponSvc.action(couponId, action, admin, {
      reason: reason || undefined, ends_at: endsAt ? new Date(endsAt).toISOString() : undefined,
    }) as any
    const past = { pause: 'paused', resume: 'resumed', end: 'ended', extend: 'extended', approve: 'approved', reject: 'rejected' }[action]
    await logAdminAction({
      adminId: admin.id, adminEmail: admin.email, action: `coupon.${past}`, resourceType: 'coupon',
      resourceId: couponId, newValue: { status: row.status, endsAt: row.ends_at }, notes: reason || undefined,
      ip: getClientIp(req), userAgent: req.headers.get('user-agent') ?? undefined,
    })
    return NextResponse.json({ data: mapCoupon(row) })
  } catch (err) {
    return serviceErrorResponse(err, `[POST coupon ${action}]`)
  }
}