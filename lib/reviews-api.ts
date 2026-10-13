// lib/reviews-api.ts
// Server-only helpers for the /api/admin/reviews/* routes.
import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { bookingErrorResponse } from '@/lib/bookings-api'
import { isUuid } from '@/lib/workers-api'
import {
  BURST_MIN_WORKERS,
  BURST_WINDOW_HOURS,
  MODERATION_STATUSES,
  REVIEW_LIST_TABS,
  REVIEW_SIGNALS,
  SHORT_COMMENT_CHARS,
  type ReviewListTab,
  type ReviewSignal,
} from '@/lib/review-constants'
import type { ReviewListItem } from '@/types/review'

// Same transaction helper the booking and dispute actions use.
export { withTx } from '@/lib/bookings-api'
export { isUuid }

const CATEGORY_RE = /^[a-z0-9-]{1,50}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// ---------- Errors ----------

export class ReviewActionError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export const reviewNotFound = () =>
  NextResponse.json({ error: 'Review not found' }, { status: 404 })

export function reviewErrorResponse(err: unknown, tag: string) {
  if (err instanceof ReviewActionError) {
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
  const code = (err as { code?: string } | null)?.code
  if (code === '42P01' || code === '42703') {
    console.error(tag, err)
    return NextResponse.json(
      {
        error:
          'Review tables are out of date. Run review-service migrations, then db/migrations/014_reviews_admin.sql.',
      },
      { status: 503 }
    )
  }
  return bookingErrorResponse(err, tag)
}

// ---------- Cache (review-service keys, see its doc section 9) ----------

export async function invalidateReviewCache(reviewId: string, workerId: string | null) {
  try {
    const keys = [`review:${reviewId}`]
    if (workerId) keys.push(`rating:summary:${workerId}`)
    await redis.del(...keys)
  } catch (err) {
    // The DB change already committed. Cache expires on its own (5-10 min).
    console.warn('[reviews] cache invalidation failed', err)
  }
}

// ---------- Predicates (list, counts and detail all share these) ----------

export const OPEN_REPORT_SQL = `EXISTS (
  SELECT 1 FROM review_reports rr WHERE rr.review_id = r.id AND rr.resolved_at IS NULL
)`

export const SHORT_ONE_STAR_SQL = `(r.rating = 1
  AND char_length(btrim(COALESCE(r.comment, ''))) < ${SHORT_COMMENT_CHARS})`

export const BURST_ONE_STAR_SQL = `(r.rating = 1 AND (
  SELECT count(DISTINCT x.worker_id) FROM reviews x
  WHERE x.user_id = r.user_id AND x.rating = 1
    AND x.created_at BETWEEN r.created_at - interval '${BURST_WINDOW_HOURS} hours'
                         AND r.created_at + interval '${BURST_WINDOW_HOURS} hours'
) >= ${BURST_MIN_WORKERS})`

const SIGNAL_SQL: Record<ReviewSignal, string> = {
  short_one_star: SHORT_ONE_STAR_SQL,
  burst_one_star: BURST_ONE_STAR_SQL,
}

export const TAB_SQL: Record<ReviewListTab, string> = {
  flagged: OPEN_REPORT_SQL,
  all: 'TRUE',
}

// Flagged: auto-hidden first (already off the public page), then most reports, then oldest.
export const TAB_ORDER: Record<ReviewListTab, string> = {
  flagged: `(r.moderation_status::text = 'AUTO_HIDDEN') DESC, r.report_count DESC, r.created_at ASC, r.id`,
  all: 'r.created_at DESC, r.id',
}

export function parseTab(value: string | null): ReviewListTab {
  return (REVIEW_LIST_TABS as readonly string[]).includes(value ?? '')
    ? (value as ReviewListTab)
    : 'flagged'
}

// ---------- List SQL ----------

export const REVIEW_FROM_SQL = `
  FROM reviews r
  LEFT JOIN reviewable_bookings rb ON rb.booking_id = r.booking_id
  LEFT JOIN users u                ON u.id = r.user_id
  LEFT JOIN workers w              ON w.id = r.worker_id
  LEFT JOIN categories c           ON c.id = rb.category_id
`

export const REVIEW_COLUMNS_SQL = `
  r.id, r.booking_id, r.user_id, r.worker_id, r.rating, r.comment, r.tags,
  COALESCE(array_length(r.photo_urls, 1), 0) AS photo_count,
  (r.worker_reply IS NOT NULL) AS has_worker_reply,
  r.moderation_status::text AS moderation_status,
  r.report_count, r.edited_at, r.created_at,
  rb.category_id, c.name AS category_name, w.city,
  u.name AS user_name, u.phone AS user_phone,
  w.name AS worker_name, w.phone AS worker_phone,
  (SELECT count(*) FROM review_reports rr
     WHERE rr.review_id = r.id AND rr.resolved_at IS NULL)::int AS open_report_count,
  (SELECT rr.reason::text FROM review_reports rr
     WHERE rr.review_id = r.id AND rr.resolved_at IS NULL
     ORDER BY rr.created_at DESC LIMIT 1) AS latest_report_reason,
  ${SHORT_ONE_STAR_SQL} AS sig_short,
  ${BURST_ONE_STAR_SQL} AS sig_burst
`

// ---------- Filters ----------

export function buildReviewWhere(sp: URLSearchParams) {
  const tab = parseTab(sp.get('tab'))
  const where: string[] = [`(${TAB_SQL[tab]})`]
  const params: unknown[] = []
  const push = (value: unknown) => {
    params.push(value)
    return `$${params.length}`
  }

  const search = (sp.get('search') || '').trim()
  const city = sp.get('city') || 'all'
  const categoryId = sp.get('categoryId') || 'all'
  const status = (sp.get('status') || 'all').toUpperCase()
  const signal = sp.get('signal') || 'all'
  const rating = Number(sp.get('rating'))
  const workerId = sp.get('workerId')
  const userId = sp.get('userId')
  const dateFrom = sp.get('dateFrom')
  const dateTo = sp.get('dateTo')

  if (search) {
    const p = push(`%${search}%`)
    where.push(
      `(r.comment ILIKE ${p} OR r.id::text ILIKE ${p} OR r.booking_id::text ILIKE ${p}
        OR u.name ILIKE ${p} OR u.phone ILIKE ${p} OR w.name ILIKE ${p} OR w.phone ILIKE ${p})`
    )
  }
  if (Number.isInteger(rating) && rating >= 1 && rating <= 5) {
    where.push(`r.rating = ${push(rating)}`)
  }
  if (city !== 'all') where.push(`w.city = ${push(city)}`)
  if (categoryId !== 'all' && CATEGORY_RE.test(categoryId)) {
    where.push(`rb.category_id = ${push(categoryId)}`)
  }
  if ((MODERATION_STATUSES as readonly string[]).includes(status)) {
    where.push(`r.moderation_status::text = ${push(status)}`)
  }
  if ((REVIEW_SIGNALS as readonly string[]).includes(signal)) {
    where.push(SIGNAL_SQL[signal as ReviewSignal])
  }
  if (workerId && isUuid(workerId)) where.push(`r.worker_id = ${push(workerId)}`)
  if (userId && isUuid(userId)) where.push(`r.user_id = ${push(userId)}`)
  if (dateFrom && DATE_RE.test(dateFrom)) where.push(`r.created_at >= ${push(dateFrom)}::date`)
  if (dateTo && DATE_RE.test(dateTo)) where.push(`r.created_at < (${push(dateTo)}::date + 1)`)

  return { tab, whereSql: `WHERE ${where.join(' AND ')}`, params }
}

// ---------- Row mapping ----------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapReviewRow(r: any): ReviewListItem {
  const signals: ReviewSignal[] = []
  if (r.sig_short) signals.push('short_one_star')
  if (r.sig_burst) signals.push('burst_one_star')

  return {
    id: r.id,
    bookingId: r.booking_id,
    rating: r.rating,
    comment: r.comment,
    tags: r.tags ?? [],
    photoCount: r.photo_count,
    hasWorkerReply: r.has_worker_reply,
    moderationStatus: r.moderation_status,
    reportCount: r.report_count,
    openReportCount: r.open_report_count,
    latestReportReason: r.latest_report_reason,
    signals,
    categoryId: r.category_id,
    categoryName: r.category_name,
    city: r.city,
    userId: r.user_id,
    userName: r.user_name,
    userPhone: r.user_phone,
    workerId: r.worker_id,
    workerName: r.worker_name,
    workerPhone: r.worker_phone,
    editedAt: r.edited_at,
    createdAt: r.created_at,
  }
}