// app/api/admin/map/demand/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { cleanCategory, mapErrorResponse } from '@/lib/map-api'
import { DEMAND_GRID_DEG, parseDemandHours } from '@/lib/map-constants'
import type { DemandCell, DemandSource, MapDemandResponse } from '@/types/map'

export const dynamic = 'force-dynamic'

async function runDemand(
  hours: number,
  categoryId: string | null,
  source: DemandSource
): Promise<DemandCell[]> {
  const { rows } = await db.query(
    `SELECT * FROM get_map_demand_cells($1::int, $2::text, $3::text, $4::double precision)`,
    [hours, categoryId, source, DEMAND_GRID_DEG]
  )
  return rows.map((r) => ({
    lat: Number(r.lat),
    lng: Number(r.lng),
    demand: Number(r.demand),
    supply: Number(r.supply),
    unserved: Number(r.unserved),
  }))
}

export async function GET(req: NextRequest) {
  const guard = await requirePermission('map:view')
  if (!guard.ok) return guard.response

  const sp = req.nextUrl.searchParams
  const hours = parseDemandHours(sp.get('hours'))
  const categoryId = cleanCategory(sp.get('categoryId'))

  try {
    // Real demand first (what customers searched for). When search-service has not logged
    // anything yet, fall back to where bookings were actually placed.
    let source: DemandSource = 'search'
    let cells = await runDemand(hours, categoryId, 'search')
    let fallback = false
    if (cells.length === 0) {
      source = 'bookings'
      fallback = true
      cells = await runDemand(hours, categoryId, 'bookings')
    }

    const body: MapDemandResponse = {
      source,
      fallback,
      hours,
      cells,
      generatedAt: new Date().toISOString(),
    }
    return NextResponse.json(body)
  } catch (err) {
    return mapErrorResponse(err, '[GET /api/admin/map/demand]')
  }
}