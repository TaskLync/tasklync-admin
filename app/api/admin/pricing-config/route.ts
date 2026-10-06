import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'

export async function GET() {
  const guard = await requirePermission('settings:view')
  if (!guard.ok) return guard.response

  const { rows } = await db.query(`SELECT * FROM platform_pricing_config WHERE id = TRUE`)
  const r = rows[0]
  return NextResponse.json({
    platformFeePercent: Number(r.platform_fee_percent),
    demandThreshold: r.demand_threshold,
    demandMultiplier: Number(r.demand_multiplier),
    urgencySameDayMultiplier: Number(r.urgency_same_day_multiplier),
    urgencyWithin2hMultiplier: Number(r.urgency_within_2h_multiplier),
    offPeakMultiplier: Number(r.off_peak_multiplier),
    updatedAt: r.updated_at,
  })
}

export async function PATCH(req: NextRequest) {
  const guard = await requirePermission('settings:edit') // SUPER_ADMIN only
  if (!guard.ok) return guard.response

  const body = await req.json().catch(() => ({}))
  const fields = [
    'platformFeePercent', 'demandThreshold', 'demandMultiplier',
    'urgencySameDayMultiplier', 'urgencyWithin2hMultiplier', 'offPeakMultiplier',
  ]
  for (const f of fields) {
    if (typeof body[f] !== 'number' || Number.isNaN(body[f])) {
      return NextResponse.json({ error: `${f} must be a number` }, { status: 400 })
    }
  }

  const { rows } = await db.query(
    `UPDATE platform_pricing_config
     SET platform_fee_percent = $1, demand_threshold = $2, demand_multiplier = $3,
         urgency_same_day_multiplier = $4, urgency_within_2h_multiplier = $5,
         off_peak_multiplier = $6, updated_by = $7, updated_at = NOW()
     WHERE id = TRUE
     RETURNING *`,
    [
      body.platformFeePercent, body.demandThreshold, body.demandMultiplier,
      body.urgencySameDayMultiplier, body.urgencyWithin2hMultiplier, body.offPeakMultiplier,
      guard.admin.adminId,
    ]
  )

  await logAdminAction({
    adminId: guard.admin.adminId,
    adminEmail: guard.admin.adminEmail,
    action: 'pricing_config.updated',
    resourceType: 'platform_config',
    resourceId: 'pricing',
    newValue: body,
    ip: getClientIp(req),
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  const r = rows[0]
  return NextResponse.json({
    platformFeePercent: Number(r.platform_fee_percent),
    demandThreshold: r.demand_threshold,
    demandMultiplier: Number(r.demand_multiplier),
    urgencySameDayMultiplier: Number(r.urgency_same_day_multiplier),
    urgencyWithin2hMultiplier: Number(r.urgency_within_2h_multiplier),
    offPeakMultiplier: Number(r.off_peak_multiplier),
    updatedAt: r.updated_at,
  })
}