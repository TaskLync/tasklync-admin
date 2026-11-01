// app/api/admin/pricing-config/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'

const num = (v: unknown) => Number(v)
const between = (n: number, lo: number, hi: number) => Number.isFinite(n) && n >= lo && n <= hi

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toJson(r: any) {
  const customer = Number(r.customer_platform_fee_percent)
  const worker = Number(r.worker_commission_percent)
  return {
    customerFeePercent: customer,
    workerCommissionPercent: worker,
    platformFeePercent: Math.round((customer + worker) * 100) / 100, // informational: total take
    demandThreshold: r.demand_threshold,
    demandMultiplier: Number(r.demand_multiplier),
    urgencySameDayMultiplier: Number(r.urgency_same_day_multiplier),
    urgencyWithin2hMultiplier: Number(r.urgency_within_2h_multiplier),
    offPeakMultiplier: Number(r.off_peak_multiplier),
    updatedAt: r.updated_at,
  }
}

export async function GET() {
  const guard = await requirePermission('settings:view')
  if (!guard.ok) return guard.response

  const { rows } = await db.query(`SELECT * FROM platform_pricing_config WHERE id = TRUE`)
  if (rows.length === 0) return NextResponse.json({ error: 'Pricing config row is missing' }, { status: 404 })
  return NextResponse.json(toJson(rows[0]))
}

export async function PATCH(req: NextRequest) {
  const guard = await requirePermission('settings:edit') // SUPER_ADMIN only
  if (!guard.ok) return guard.response

  const body = await req.json().catch(() => ({}))

  let customer = num(body.customerFeePercent)
  let worker = num(body.workerCommissionPercent)
  if (body.customerFeePercent === undefined || body.workerCommissionPercent === undefined) {
    // legacy payload: one number for the whole take
    const total = num(body.platformFeePercent)
    customer = Math.round((total / 2) * 100) / 100
    worker = Math.round((total / 2) * 100) / 100
  }

  const checks: [string, boolean][] = [
    ['customerFeePercent must be between 0 and 30', between(customer, 0, 30)],
    ['workerCommissionPercent must be between 0 and 30', between(worker, 0, 30)],
    ['demandThreshold must be a whole number between 0 and 100',
      Number.isInteger(num(body.demandThreshold)) && between(num(body.demandThreshold), 0, 100)],
    ['demandMultiplier must be between 0.5 and 3', between(num(body.demandMultiplier), 0.5, 3)],
    ['urgencySameDayMultiplier must be between 0.5 and 3', between(num(body.urgencySameDayMultiplier), 0.5, 3)],
    ['urgencyWithin2hMultiplier must be between 0.5 and 3', between(num(body.urgencyWithin2hMultiplier), 0.5, 3)],
    ['offPeakMultiplier must be between 0.5 and 3', between(num(body.offPeakMultiplier), 0.5, 3)],
  ]
  const bad = checks.find(([, ok]) => !ok)
  if (bad) return NextResponse.json({ error: bad[0] }, { status: 400 })

  const before = await db.query(`SELECT * FROM platform_pricing_config WHERE id = TRUE`)

  const { rows } = await db.query(
    `UPDATE platform_pricing_config
        SET customer_platform_fee_percent = $1, worker_commission_percent = $2,
            platform_fee_percent = $1 + $2,
            demand_threshold = $3, demand_multiplier = $4,
            urgency_same_day_multiplier = $5, urgency_within_2h_multiplier = $6,
            off_peak_multiplier = $7, updated_by = $8, updated_at = NOW()
      WHERE id = TRUE
      RETURNING *`,
    [
      customer, worker, body.demandThreshold, body.demandMultiplier,
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
    oldValue: before.rows[0] ? toJson(before.rows[0]) : undefined,
    newValue: toJson(rows[0]),
    notes: 'booking-service picks this up within about 60 seconds',
    ip: getClientIp(req),
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json(toJson(rows[0]))
}