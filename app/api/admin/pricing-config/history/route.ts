// app/api/admin/pricing-config/history/route.ts
// Append-only history of every saved pricing configuration (newest first).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'

export async function GET() {
  const guard = await requirePermission('settings:view')
  if (!guard.ok) return guard.response

  const { rows } = await db.query(
    `SELECT version, changed_at, changed_by_email, reason, config
       FROM platform_pricing_config_history
      ORDER BY version DESC
      LIMIT 20`,
  )
  return NextResponse.json(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rows.map((r: any) => ({
      version: r.version,
      changedAt: r.changed_at,
      changedByEmail: r.changed_by_email,
      reason: r.reason,
      customerFeeEnabled: r.config?.customer_fee_enabled !== false,
      customerFeePercent: Number(r.config?.customer_platform_fee_percent ?? 0),
      workerCommissionEnabled: r.config?.worker_commission_enabled !== false,
      workerCommissionPercent: Number(r.config?.worker_commission_percent ?? 0),
      taxEnabled: r.config?.tax_enabled === true,
      taxPercent: Number(r.config?.tax_percent ?? 0),
      // versions saved before migration 018 had these charges fixed in code (on)
      cancellationFeesEnabled: r.config?.cancellation_fees_enabled !== false,
      noShowFeeEnabled: r.config?.no_show_fee_enabled !== false,
    })),
  )
}
