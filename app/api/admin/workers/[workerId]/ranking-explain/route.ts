import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { rankingSvc } from '@/lib/services/search'
import { serviceErrorResponse } from '@/lib/internal-client'
import { explainQuerySchema, mapExplain } from '@/lib/ranking-api'
import { zodResponse } from '@/lib/coupons-api'

export const dynamic = 'force-dynamic'

// Read only. Nothing is written anywhere, so no audit row (same rule as simulate).
export async function GET(req: NextRequest, { params }: { params: Promise<{ workerId: string }> }) {
  const guard = await requirePermission('ranking:view')
  if (!guard.ok) return guard.response
  const { workerId } = await params // UUID checked by middleware
  try {
    const q = explainQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams))
    const out = await rankingSvc.explain({
      worker_id: workerId, q: q.q, category_id: q.categoryId, city: q.city, lat: q.lat, lng: q.lng, radius: q.radius,
    })
    return NextResponse.json({ data: mapExplain(out) })
  } catch (err) {
    return zodResponse(err) ?? serviceErrorResponse(err, '[GET worker ranking explain]')
  }
}