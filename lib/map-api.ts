// lib/map-api.ts
// Server-only helpers for the /api/admin/map/* routes.
import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { STATUS_SQL } from '@/lib/workers-api'

const CATEGORY_RE = /^[a-z0-9-]{1,50}$/i

export function mapErrorResponse(err: unknown, tag: string) {
  console.error(tag, err)
  return NextResponse.json({ error: 'Failed to load map data' }, { status: 500 })
}

/** Returns null for "all" / empty / junk. The value is still always passed as a SQL parameter. */
export function cleanCity(raw: string | null): string | null {
  const v = (raw || '').trim()
  return v && v !== 'all' && v.length <= 100 ? v : null
}

export function cleanCategory(raw: string | null): string | null {
  const v = (raw || '').trim()
  return v && v !== 'all' && CATEGORY_RE.test(v) ? v : null
}

/**
 * Workers that can be shown on the map: verified, not deleted, account status "active"
 * (suspended / banned workers are not bookable, so they are not supply).
 */
export function buildMapWorkerWhere(sp: URLSearchParams): { where: string[]; params: unknown[] } {
  const where: string[] = [
    'w.deleted_at IS NULL',
    `${STATUS_SQL} = 'active'`,
    `w.verification_status::text = 'VERIFIED'`,
  ]
  const params: unknown[] = []
  const push = (value: unknown) => {
    params.push(value)
    return `$${params.length}`
  }

  const city = cleanCity(sp.get('city'))
  const categoryId = cleanCategory(sp.get('categoryId'))

  if (city) where.push(`w.city = ${push(city)}`)
  if (categoryId) {
    where.push(
      `EXISTS (SELECT 1 FROM worker_skills ws WHERE ws.worker_id = w.id AND ws.category_id = ${push(categoryId)})`
    )
  }
  return { where, params }
}

// ---------- Optional Redis overlay (fresher than the 30 s DB flush) ----------

const USE_REDIS_LOCATION = process.env.MAP_USE_REDIS_LOCATION === 'true'

interface Overlay {
  lat: number
  lng: number
  at: string | null
}

/**
 * ASSUMPTION A4: worker-service stores JSON with numeric `lat` and `lng` at
 * `worker:location:{workerId}` (TTL 90 s). Anything else is ignored, never thrown.
 */
export async function fetchRedisLocations(ids: string[]): Promise<Map<string, Overlay>> {
  const out = new Map<string, Overlay>()
  if (!USE_REDIS_LOCATION || ids.length === 0) return out
  try {
    const raws = await redis.mget(ids.map((id) => `worker:location:${id}`))
    raws.forEach((raw, i) => {
      if (!raw) return
      try {
        const p = JSON.parse(raw)
        const lat = Number(p?.lat)
        const lng = Number(p?.lng)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
        const stamp = p?.timestamp ?? p?.updatedAt ?? null
        out.set(ids[i], {
          lat,
          lng,
          at: typeof stamp === 'string' || typeof stamp === 'number' ? new Date(stamp).toISOString() : null,
        })
      } catch {
        /* malformed entry: keep the DB position */
      }
    })
  } catch (err) {
    console.error('[map] redis overlay failed, using DB positions', err)
  }
  return out
}