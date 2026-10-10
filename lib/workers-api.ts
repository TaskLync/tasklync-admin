// lib/workers-api.ts
// Shared helpers for the /api/admin/workers/* routes.
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const CATEGORY_RE = /^[a-z0-9-]{1,50}$/i

export const isUuid = (value: string) => UUID_RE.test(value)

export const workerNotFound = () =>
  NextResponse.json({ error: 'Worker not found' }, { status: 404 })

// SQL fragments, defined once so list + export can never disagree.
export const STATUS_SQL =
  'fn_worker_status(w.is_active, w.deleted_at, w.banned_at, w.suspended_until)'
export const PRESENCE_SQL =
  'fn_worker_presence(w.is_active, w.manually_paused, w.is_on_job, w.last_seen_at)'
export const CATEGORY_NAMES_SQL = `(
  SELECT string_agg(c.name, ', ' ORDER BY c.sort_order, c.name)
  FROM worker_skills ws
  JOIN categories c ON c.id = ws.category_id
  WHERE ws.worker_id = w.id
)`

export const SORT_COLUMNS: Record<string, string> = {
  created_at: 'w.created_at',
  name: 'w.name',
  total_bookings: 'w.total_bookings',
  avg_rating: 'w.avg_rating',
}

const ACCOUNT_STATUSES = ['active', 'inactive', 'suspended', 'banned', 'deleted']
const PRESENCES = ['online', 'away', 'offline', 'paused', 'on_job']
const VERIFICATIONS = ['unverified', 'pending_review', 'verified', 'rejected', 'suspended']

// Only workers who have reviews can be "below 3.0": a brand-new worker has
// avg_rating = 0 and must not show up as a problem worker.
const RATING_BUCKETS: Record<string, string> = {
  lt3: 'w.total_reviews > 0 AND w.avg_rating < 3',
  '3-4': 'w.total_reviews > 0 AND w.avg_rating >= 3 AND w.avg_rating < 4',
  '4+': 'w.total_reviews > 0 AND w.avg_rating >= 4',
  unrated: 'COALESCE(w.total_reviews, 0) = 0',
}

export function buildWorkerWhere(sp: URLSearchParams): { whereSql: string; params: unknown[] } {
  const where: string[] = []
  const params: unknown[] = []
  const push = (value: unknown) => {
    params.push(value)
    return `$${params.length}`
  }

  const search = (sp.get('search') || '').trim()
  const city = sp.get('city') || 'all'
  const categoryId = sp.get('categoryId') || 'all'
  const verification = sp.get('verification') || 'all'
  const status = sp.get('status') || 'all'
  const presence = sp.get('presence') || 'all'
  const ratingBucket = sp.get('ratingBucket') || 'all'
  const dateFrom = sp.get('dateFrom')
  const dateTo = sp.get('dateTo')

  if (search) {
    const p = push(`%${search}%`)
    where.push(`(w.name ILIKE ${p} OR w.phone ILIKE ${p} OR w.email ILIKE ${p})`)
  }

  if (city !== 'all') {
    where.push(`w.city = ${push(city)}`)
  }

  if (categoryId !== 'all' && CATEGORY_RE.test(categoryId)) {
    where.push(
      `EXISTS (SELECT 1 FROM worker_skills ws WHERE ws.worker_id = w.id AND ws.category_id = ${push(categoryId)})`
    )
  }

  if (VERIFICATIONS.includes(verification)) {
    where.push(`w.verification_status::text = ${push(verification.toUpperCase())}`)
  }

  // Deleted workers are hidden unless you explicitly filter for them,
  // so the list total matches the "Total Workers" KPI.
  if (ACCOUNT_STATUSES.includes(status)) {
    where.push(`${STATUS_SQL} = ${push(status)}`)
  } else {
    where.push('w.deleted_at IS NULL')
  }

  if (PRESENCES.includes(presence)) {
    where.push(`${PRESENCE_SQL} = ${push(presence)}`)
  }

  if (RATING_BUCKETS[ratingBucket]) {
    where.push(`(${RATING_BUCKETS[ratingBucket]})`)
  }

  if (dateFrom && DATE_RE.test(dateFrom)) {
    where.push(`w.created_at >= ${push(dateFrom)}::date`)
  }
  if (dateTo && DATE_RE.test(dateTo)) {
    // inclusive of the whole "to" day
    where.push(`w.created_at < (${push(dateTo)}::date + 1)`)
  }

  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params }
}