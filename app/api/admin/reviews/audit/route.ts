// app/api/admin/reviews/audit/route.ts  (spec 10.3: worker rating audit)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { reviewErrorResponse } from '@/lib/reviews-api'
import {
  AUDIT_FLAGS,
  AUDIT_MIN_REVIEWS,
  COMPLAINT_MIN,
  COMPLAINT_WINDOW_DAYS,
  LOW_RATING_THRESHOLD,
  RATING_DROP_THRESHOLD,
  type AuditFlag,
} from '@/lib/review-constants'
import type { AuditListResponse, AuditWorkerRow } from '@/types/review'

export const dynamic = 'force-dynamic'

// Only publicly visible reviews count toward a worker's rating.
// All thresholds are numeric constants, so inlining them is safe.
const SCORED_CTE = `
  WITH vis AS (
    SELECT worker_id, rating, created_at
    FROM reviews
    WHERE moderation_status::text IN ('VISIBLE', 'ADMIN_RESTORED')
  ),
  agg AS (
    SELECT worker_id,
           count(*)::int AS total,
           avg(rating) AS avg_now,
           count(*) FILTER (WHERE created_at <  now() - interval '7 days')::int AS total_before,
           avg(rating) FILTER (WHERE created_at <  now() - interval '7 days') AS avg_before,
           count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS recent
    FROM vis
    GROUP BY worker_id
  ),
  disp AS (
    SELECT raised_against AS worker_id, count(*)::int AS n
    FROM disputes
    WHERE created_at >= now() - interval '${COMPLAINT_WINDOW_DAYS} days'
    GROUP BY raised_against
  ),
  scored AS (
    SELECT w.id, w.name, w.phone, w.city, w.avatar_url, w.warning_count,
           COALESCE(agg.total, 0) AS total,
           agg.avg_now, agg.avg_before,
           COALESCE(agg.recent, 0) AS recent,
           COALESCE(disp.n, 0) AS disputes_30d,
           (COALESCE(agg.total, 0) >= ${AUDIT_MIN_REVIEWS}
              AND agg.avg_now < ${LOW_RATING_THRESHOLD}) AS low_rating,
           (COALESCE(agg.total_before, 0) >= ${AUDIT_MIN_REVIEWS}
              AND COALESCE(agg.recent, 0) >= 1
              AND agg.avg_before - agg.avg_now > ${RATING_DROP_THRESHOLD}) AS rapid_drop,
           (COALESCE(disp.n, 0) >= ${COMPLAINT_MIN}) AS many_disputes
    FROM workers w
    LEFT JOIN agg  ON agg.worker_id  = w.id
    LEFT JOIN disp ON disp.worker_id = w.id
    WHERE w.deleted_at IS NULL
  )
`

export async function GET(req: NextRequest) {
  const guard = await requirePermission('reviews:view')
  if (!guard.ok) return guard.response

  const sp = req.nextUrl.searchParams
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '20', 10) || 20))
  const offset = (page - 1) * pageSize

  const flag = sp.get('flag') || 'all'
  const city = sp.get('city') || 'all'
  const search = (sp.get('search') || '').trim()

  const where: string[] = []
  const params: unknown[] = []
  const push = (v: unknown) => {
    params.push(v)
    return `$${params.length}`
  }

  if ((AUDIT_FLAGS as readonly string[]).includes(flag)) {
    where.push(`q.${flag as AuditFlag}`) // whitelisted above, safe to inline
  } else {
    where.push('(q.low_rating OR q.rapid_drop OR q.many_disputes)')
  }
  if (city !== 'all') where.push(`q.city = ${push(city)}`)
  if (search) {
    const p = push(`%${search}%`)
    where.push(`(q.name ILIKE ${p} OR q.phone ILIKE ${p})`)
  }
  const whereSql = `WHERE ${where.join(' AND ')}`

  try {
    const [listRes, countRes] = await Promise.all([
      db.query(
        `${SCORED_CTE}
         SELECT q.* FROM scored q
         ${whereSql}
         ORDER BY (q.low_rating::int + q.rapid_drop::int + q.many_disputes::int) DESC,
                  q.avg_now ASC NULLS LAST, q.id
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, pageSize, offset]
      ),
      db.query(`${SCORED_CTE} SELECT count(*)::int AS total FROM scored q ${whereSql}`, params),
    ])

    const data: AuditWorkerRow[] = listRes.rows.map((r) => {
      const flags: AuditFlag[] = []
      if (r.low_rating) flags.push('low_rating')
      if (r.rapid_drop) flags.push('rapid_drop')
      if (r.many_disputes) flags.push('many_disputes')

      const avgNow = r.avg_now === null ? null : Number(r.avg_now)
      const avgBefore = r.avg_before === null ? null : Number(r.avg_before)
      return {
        workerId: r.id,
        name: r.name,
        phone: r.phone,
        city: r.city,
        avatarUrl: r.avatar_url,
        warningCount: r.warning_count ?? 0,
        totalReviews: r.total,
        avgRating: avgNow === null ? null : Math.round(avgNow * 100) / 100,
        avgBefore: avgBefore === null ? null : Math.round(avgBefore * 100) / 100,
        drop:
          avgNow !== null && avgBefore !== null && r.recent > 0
            ? Math.round((avgBefore - avgNow) * 100) / 100
            : null,
        recentReviews: r.recent,
        disputes30d: r.disputes_30d,
        flags,
      }
    })

    const total = countRes.rows[0]?.total ?? 0
    const payload: AuditListResponse = {
      data,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    }
    return NextResponse.json(payload)
  } catch (err) {
    return reviewErrorResponse(err, '[GET /api/admin/reviews/audit]')
  }
}