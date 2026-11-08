import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { promotionSvc } from '@/lib/services/booking'
import { serviceErrorResponse } from '@/lib/internal-client'
import { mapPromotion } from '@/lib/promotions-api'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requirePermission('promotions:view')
  if (!guard.ok) return guard.response
  const sp = req.nextUrl.searchParams
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '20', 10) || 20))
  try {
    const out = await promotionSvc.list({
      status: sp.get('status') || undefined,
      search: sp.get('search') || undefined,
      page,
      page_size: pageSize,
    })
    return NextResponse.json({
      data: out.items.map(mapPromotion), page, pageSize, total: out.total,
      totalPages: Math.max(1, Math.ceil(out.total / pageSize)),
    })
  } catch (err) {
    return serviceErrorResponse(err, '[GET promotions]')
  }
}