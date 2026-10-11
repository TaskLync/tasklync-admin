// app/api/admin/map/bookings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { CITY_SQL, FROM_SQL } from '@/lib/bookings-api'
import { cleanCategory, cleanCity, mapErrorResponse } from '@/lib/map-api'
import { MAP_JOB_LIMIT } from '@/lib/map-constants'
import type { MapJob, MapJobStatus, MapJobsResponse } from '@/types/map'

export const dynamic = 'force-dynamic'

const MAP_STATUSES: MapJobStatus[] = ['ACCEPTED', 'IN_PROGRESS']

export async function GET(req: NextRequest) {
  const guard = await requirePermission('map:view')
  if (!guard.ok) return guard.response

  const sp = req.nextUrl.searchParams
  const statusParam = sp.get('status') || 'all'
  const statuses = (MAP_STATUSES as string[]).includes(statusParam) ? [statusParam] : MAP_STATUSES

  const params: unknown[] = []
  const push = (value: unknown) => {
    params.push(value)
    return `$${params.length}`
  }

  const where: string[] = [
    `b.status::text = ANY(${push(statuses)}::text[])`,
    'b.job_site_location IS NOT NULL',
  ]
  const city = cleanCity(sp.get('city'))
  const categoryId = cleanCategory(sp.get('categoryId'))
  if (city) where.push(`${CITY_SQL} = ${push(city)}`)
  if (categoryId) where.push(`b.category_id = ${push(categoryId)}`)

  const sql = `
    SELECT
      b.id, b.status::text AS status, b.category_id, c.name AS category_name,
      b.estimated_total, b.currency, b.scheduled_at, b.started_at, b.updated_at,
      ${CITY_SQL} AS city,
      u.name AS user_name,
      w.id   AS worker_id, w.name AS worker_name,
      ST_Y(b.job_site_location::geometry)  AS job_lat,
      ST_X(b.job_site_location::geometry)  AS job_lng,
      ST_Y(wl.location::geometry)          AS worker_lat,
      ST_X(wl.location::geometry)          AS worker_lng,
      wl.updated_at                        AS worker_location_at
    ${FROM_SQL}
    LEFT JOIN worker_locations wl ON wl.worker_id = b.worker_id
    WHERE ${where.join(' AND ')}
    ORDER BY (b.status::text = 'IN_PROGRESS') DESC, b.scheduled_at
    LIMIT ${push(MAP_JOB_LIMIT)}
  `

  try {
    const { rows } = await db.query(sql, params)

    const data: MapJob[] = rows.map((r) => ({
      id: r.id,
      status: r.status,
      categoryId: r.category_id,
      categoryName: r.category_name,
      city: r.city,
      amount: Number(r.estimated_total ?? 0),
      currency: r.currency ?? 'PKR',
      scheduledAt: r.scheduled_at,
      startedAt: r.started_at,
      updatedAt: r.updated_at,
      userName: r.user_name,
      workerId: r.worker_id,
      workerName: r.worker_name,
      jobLat: Number(r.job_lat),
      jobLng: Number(r.job_lng),
      workerLat: r.worker_lat === null ? null : Number(r.worker_lat),
      workerLng: r.worker_lng === null ? null : Number(r.worker_lng),
      workerLocationAt: r.worker_location_at,
    }))

    const inProgress = data.filter((j) => j.status === 'IN_PROGRESS').length
    const body: MapJobsResponse = {
      data,
      counts: { inProgress, accepted: data.length - inProgress, total: data.length },
      truncated: data.length >= MAP_JOB_LIMIT,
      limit: MAP_JOB_LIMIT,
      generatedAt: new Date().toISOString(),
    }
    return NextResponse.json(body)
  } catch (err) {
    return mapErrorResponse(err, '[GET /api/admin/map/bookings]')
  }
}