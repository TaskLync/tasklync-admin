// app/api/admin/map/workers/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { CATEGORY_NAMES_SQL, PRESENCE_SQL } from '@/lib/workers-api'
import { buildMapWorkerWhere, fetchRedisLocations, mapErrorResponse } from '@/lib/map-api'
import { MAP_WORKER_LIMIT } from '@/lib/map-constants'
import type { MapWorker, MapWorkerCounts, MapWorkersResponse } from '@/types/map'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requirePermission('map:view')
  if (!guard.ok) return guard.response

  const sp = req.nextUrl.searchParams
  const includeOffline = sp.get('includeOffline') === 'true'
  const { where, params } = buildMapWorkerWhere(sp)

  const listWhere = [...where]
  if (!includeOffline) listWhere.push(`${PRESENCE_SQL} <> 'offline'`)

  const listSql = `
    SELECT
      w.id, w.name, w.avatar_url, w.city, w.avg_rating, w.total_reviews, w.last_seen_at,
      ST_Y(wl.location::geometry) AS lat,
      ST_X(wl.location::geometry) AS lng,
      wl.updated_at AS location_updated_at,
      ${PRESENCE_SQL}       AS presence,
      ${CATEGORY_NAMES_SQL} AS categories,
      ab.id AS active_booking_id
    FROM workers w
    JOIN worker_locations wl ON wl.worker_id = w.id
    LEFT JOIN LATERAL (
      SELECT b.id
      FROM bookings b
      WHERE b.worker_id = w.id AND b.status::text IN ('IN_PROGRESS', 'ACCEPTED')
      ORDER BY (b.status::text = 'IN_PROGRESS') DESC, b.scheduled_at
      LIMIT 1
    ) ab ON true
    WHERE ${listWhere.join(' AND ')}
    ORDER BY wl.updated_at DESC
    LIMIT $${params.length + 1}
  `

  // Counts use a LEFT JOIN so a worker with no GPS row yet is still counted as online.
  const countSql = `
    SELECT ${PRESENCE_SQL} AS presence,
           count(*)::int AS total,
           (count(*) FILTER (WHERE wl.worker_id IS NULL))::int AS no_location
    FROM workers w
    LEFT JOIN worker_locations wl ON wl.worker_id = w.id
    WHERE ${where.join(' AND ')}
    GROUP BY 1
  `

  try {
    const [listRes, countRes] = await Promise.all([
      db.query(listSql, [...params, MAP_WORKER_LIMIT]),
      db.query(countSql, params),
    ])

    const overlay = await fetchRedisLocations(listRes.rows.map((r) => r.id))

    const data: MapWorker[] = listRes.rows.map((r) => {
      const o = overlay.get(r.id)
      return {
        id: r.id,
        name: r.name,
        avatarUrl: r.avatar_url,
        city: r.city,
        categories: r.categories,
        avgRating: Number(r.avg_rating ?? 0),
        totalReviews: r.total_reviews ?? 0,
        presence: r.presence,
        lat: o ? o.lat : Number(r.lat),
        lng: o ? o.lng : Number(r.lng),
        lastSeenAt: r.last_seen_at,
        locationUpdatedAt: o?.at ?? r.location_updated_at,
        activeBookingId: r.active_booking_id,
      }
    })

    const counts: MapWorkerCounts = {
      online: 0,
      away: 0,
      onJob: 0,
      paused: 0,
      offline: 0,
      noLocation: 0,
    }
    for (const r of countRes.rows) {
      const n = Number(r.total)
      switch (r.presence) {
        case 'online':
          counts.online = n
          counts.noLocation += Number(r.no_location)
          break
        case 'away':
          counts.away = n
          counts.noLocation += Number(r.no_location)
          break
        case 'on_job':
          counts.onJob = n
          counts.noLocation += Number(r.no_location)
          break
        case 'paused':
          counts.paused = n
          break
        default:
          counts.offline += n
      }
    }

    const body: MapWorkersResponse = {
      data,
      counts,
      truncated: data.length >= MAP_WORKER_LIMIT,
      limit: MAP_WORKER_LIMIT,
      generatedAt: new Date().toISOString(),
    }
    return NextResponse.json(body)
  } catch (err) {
    return mapErrorResponse(err, '[GET /api/admin/map/workers]')
  }
}