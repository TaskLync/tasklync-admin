import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { rankingSvc } from '@/lib/services/search'
import { serviceErrorResponse } from '@/lib/internal-client'
import { simulateSchema } from '@/lib/ranking-api'
import { zodResponse } from '@/lib/coupons-api'

export const dynamic = 'force-dynamic'

// Read-only on the search side: nothing is cached or logged there. No audit row (it changes nothing).
export async function POST(req: NextRequest) {
  const guard = await requirePermission('ranking:config')
  if (!guard.ok) return guard.response
  try {
    const b = simulateSchema.parse(await req.json().catch(() => ({})))
    const out = await rankingSvc.simulate({
      candidate: {
        weights: b.candidate.weights, params: b.candidate.params,
        prior_mean: b.candidate.priorMean, prior_weight: b.candidate.priorWeight,
      },
      top: b.top,
      queries: b.queries,
    })
    return NextResponse.json({ data: out })
  } catch (err) {
    return zodResponse(err) ?? serviceErrorResponse(err, '[POST ranking simulate]')
  }
}