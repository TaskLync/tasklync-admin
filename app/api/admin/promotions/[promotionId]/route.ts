import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { promotionSvc } from '@/lib/services/booking'
import { serviceErrorResponse } from '@/lib/internal-client'
import { mapPromotion } from '@/lib/promotions-api'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ promotionId: string }> }) {
  const guard = await requirePermission('promotions:view')
  if (!guard.ok) return guard.response
  const { promotionId } = await params
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = (await promotionSvc.get(promotionId)) as any
    const s = r.stats ?? {}
    return NextResponse.json({
      ...mapPromotion(r),
      stats: {
        consumed: Number(s.consumed ?? 0),
        released: Number(s.released ?? 0),
        discountPkr: Number(s.discount_pkr ?? s.discount_total ?? 0),
        workerCostPkr: Number(s.worker_cost_pkr ?? s.worker_cost_total ?? 0),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      history: (r.history ?? []).map((h: any) => ({
        fromStatus: h.from_status ?? null, toStatus: h.to_status, actorType: h.actor_type,
        actorEmail: h.actor_email ?? null, note: h.note ?? null, createdAt: h.created_at,
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      abuseSignals: (r.abuse_signals ?? r.abuseSignals ?? []).map((a: any) => ({
        id: String(a.id), signal: a.signal, severity: Number(a.severity ?? 1), detail: a.detail ?? null, createdAt: a.created_at,
      })),
    })
  } catch (err) {
    return serviceErrorResponse(err, '[GET promotion]')
  }
}