// app/api/admin/pricing-config/route.ts
// Live fee / commission / tax configuration. booking-service reads platform_pricing_config for every new
// booking and quote (cached ~60s) and snapshots the result on the booking, so changes never reprice
// existing bookings or quotes that were already sent.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'

const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN)
const between = (n: number, lo: number, hi: number) => Number.isFinite(n) && n >= lo && n <= hi
const twoDp = (n: number) => Math.round(n * 100) / 100

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toJson(r: any) {
  const customerEnabled = r.customer_fee_enabled !== false
  const workerEnabled = r.worker_commission_enabled !== false
  const customer = Number(r.customer_platform_fee_percent)
  const worker = Number(r.worker_commission_percent)
  return {
    customerFeeEnabled: customerEnabled,
    customerFeePercent: customer,
    workerCommissionEnabled: workerEnabled,
    workerCommissionPercent: worker,
    taxEnabled: r.tax_enabled === true,
    taxPercent: Number(r.tax_percent ?? 0),
    taxLabel: r.tax_label ?? 'Tax',
    taxAppliesTo: r.tax_applies_to === 'subtotal_and_fee' ? 'subtotal_and_fee' : 'subtotal',
    cancellationFeesEnabled: r.cancellation_fees_enabled !== false,
    cancelFeeOver24hPercent: Number(r.cancel_fee_over_24h_percent ?? 0),
    cancelFeeWithin24hPercent: Number(r.cancel_fee_within_24h_percent ?? 0),
    cancelFeeAfterArrivalPercent: Number(r.cancel_fee_after_arrival_percent ?? 0),
    noShowFeeEnabled: r.no_show_fee_enabled !== false,
    noShowFeePkr: Number(r.no_show_fee_pkr ?? 0),
    // informational: what the platform takes in total right now
    platformFeePercent: twoDp((customerEnabled ? customer : 0) + (workerEnabled ? worker : 0)),
    demandThreshold: r.demand_threshold,
    demandMultiplier: Number(r.demand_multiplier),
    offPeakMultiplier: Number(r.off_peak_multiplier),
    version: Number(r.version ?? 1),
    effectiveFrom: r.effective_from ?? r.updated_at,
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

  const input = {
    customerFeeEnabled: body.customerFeeEnabled,
    customerFeePercent: num(body.customerFeePercent),
    workerCommissionEnabled: body.workerCommissionEnabled,
    workerCommissionPercent: num(body.workerCommissionPercent),
    taxEnabled: body.taxEnabled,
    taxPercent: num(body.taxPercent),
    taxLabel: typeof body.taxLabel === 'string' ? body.taxLabel.trim() : '',
    taxAppliesTo: body.taxAppliesTo,
    cancellationFeesEnabled: body.cancellationFeesEnabled,
    cancelFeeOver24hPercent: num(body.cancelFeeOver24hPercent),
    cancelFeeWithin24hPercent: num(body.cancelFeeWithin24hPercent),
    cancelFeeAfterArrivalPercent: num(body.cancelFeeAfterArrivalPercent),
    noShowFeeEnabled: body.noShowFeeEnabled,
    noShowFeePkr: num(body.noShowFeePkr),
    demandThreshold: num(body.demandThreshold),
    demandMultiplier: num(body.demandMultiplier),
    offPeakMultiplier: num(body.offPeakMultiplier),
    expectedVersion: num(body.expectedVersion),
    reason: typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '',
  }

  const checks: [string, boolean][] = [
    ['customerFeeEnabled must be true or false', typeof input.customerFeeEnabled === 'boolean'],
    ['workerCommissionEnabled must be true or false', typeof input.workerCommissionEnabled === 'boolean'],
    ['taxEnabled must be true or false', typeof input.taxEnabled === 'boolean'],
    ['customerFeePercent must be between 0 and 30', between(input.customerFeePercent, 0, 30)],
    ['workerCommissionPercent must be between 0 and 30', between(input.workerCommissionPercent, 0, 30)],
    ['taxPercent must be between 0 and 50', between(input.taxPercent, 0, 50)],
    ['taxLabel must be 1 to 40 characters', input.taxLabel.length >= 1 && input.taxLabel.length <= 40],
    ['taxAppliesTo must be "subtotal" or "subtotal_and_fee"',
      input.taxAppliesTo === 'subtotal' || input.taxAppliesTo === 'subtotal_and_fee'],
    ['cancellationFeesEnabled must be true or false', typeof input.cancellationFeesEnabled === 'boolean'],
    ['Cancellation fee (more than 24h before) must be between 0 and 100', between(input.cancelFeeOver24hPercent, 0, 100)],
    ['Cancellation fee (24h or less before) must be between 0 and 100', between(input.cancelFeeWithin24hPercent, 0, 100)],
    ['Cancellation fee (worker already arrived) must be between 0 and 100', between(input.cancelFeeAfterArrivalPercent, 0, 100)],
    ['noShowFeeEnabled must be true or false', typeof input.noShowFeeEnabled === 'boolean'],
    ['No-show fee must be between 0 and 100000', between(input.noShowFeePkr, 0, 100000)],
    ['demandThreshold must be a whole number between 0 and 100',
      Number.isInteger(input.demandThreshold) && between(input.demandThreshold, 0, 100)],
    ['demandMultiplier must be between 0.5 and 3', between(input.demandMultiplier, 0.5, 3)],
    ['offPeakMultiplier must be between 0.5 and 3', between(input.offPeakMultiplier, 0.5, 3)],
    ['expectedVersion is required', Number.isInteger(input.expectedVersion) && input.expectedVersion >= 1],
  ]
  const bad = checks.find(([, ok]) => !ok)
  if (bad) return NextResponse.json({ error: bad[0] }, { status: 400 })

  const customer = twoDp(input.customerFeePercent)
  const worker = twoDp(input.workerCommissionPercent)
  const tax = twoDp(input.taxPercent)

  const client = await db.connect()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let before: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let after: any
  try {
    await client.query('BEGIN')
    // Row lock: two admins saving at once are serialised; the version check then rejects the stale one.
    const current = await client.query(`SELECT * FROM platform_pricing_config WHERE id = TRUE FOR UPDATE`)
    if (current.rows.length === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Pricing config row is missing' }, { status: 404 })
    }
    before = current.rows[0]
    if (Number(before.version ?? 1) !== input.expectedVersion) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { error: 'Pricing was changed by someone else. Reload to see the latest values before saving.' },
        { status: 409 },
      )
    }

    const { rows } = await client.query(
      `UPDATE platform_pricing_config
          SET customer_fee_enabled = $1, customer_platform_fee_percent = $2,
              worker_commission_enabled = $3, worker_commission_percent = $4,
              platform_fee_percent = (CASE WHEN $1 THEN $2 ELSE 0 END) + (CASE WHEN $3 THEN $4 ELSE 0 END),
              tax_enabled = $5, tax_percent = $6, tax_label = $7, tax_applies_to = $8,
              demand_threshold = $9, demand_multiplier = $10, off_peak_multiplier = $11,
              cancellation_fees_enabled = $13, cancel_fee_over_24h_percent = $14,
              cancel_fee_within_24h_percent = $15, cancel_fee_after_arrival_percent = $16,
              no_show_fee_enabled = $17, no_show_fee_pkr = $18,
              version = version + 1, effective_from = NOW(),
              updated_by = $12, updated_at = NOW()
        WHERE id = TRUE
        RETURNING *`,
      [
        input.customerFeeEnabled, customer, input.workerCommissionEnabled, worker,
        input.taxEnabled, tax, input.taxLabel, input.taxAppliesTo,
        input.demandThreshold, input.demandMultiplier, input.offPeakMultiplier,
        guard.admin.adminId,
        input.cancellationFeesEnabled, twoDp(input.cancelFeeOver24hPercent),
        twoDp(input.cancelFeeWithin24hPercent), twoDp(input.cancelFeeAfterArrivalPercent),
        input.noShowFeeEnabled, twoDp(input.noShowFeePkr),
      ],
    )
    after = rows[0]

    await client.query(
      `INSERT INTO platform_pricing_config_history (version, config, changed_by, changed_by_email, reason)
       VALUES ($1, $2::jsonb, $3, $4, $5)`,
      [after.version, JSON.stringify(after), guard.admin.adminId, guard.admin.adminEmail, input.reason || null],
    )
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }

  await logAdminAction({
    adminId: guard.admin.adminId,
    adminEmail: guard.admin.adminEmail,
    action: 'pricing_config.updated',
    resourceType: 'platform_config',
    resourceId: 'pricing',
    oldValue: toJson(before),
    newValue: toJson(after),
    notes: `version ${after.version}${input.reason ? `: ${input.reason}` : ''}. booking-service picks this up within about 60 seconds`,
    ip: getClientIp(req),
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json(toJson(after))
}
