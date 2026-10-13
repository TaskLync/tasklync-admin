// app/api/admin/reviews/counts/route.ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { reviewErrorResponse } from '@/lib/reviews-api'
import type { ReviewCounts } from '@/types/review'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermission('reviews:view')
  if (!guard.ok) return guard.response

  try {
    const [main, flagged, spark] = await Promise.all([
      db.query(`
        SELECT
          count(*)::int AS total,
          (count(*) FILTER (WHERE r.moderation_status::text = 'AUTO_HIDDEN'))::int AS auto_hidden,
          (count(*) FILTER (WHERE r.moderation_status::text = 'ADMIN_HIDDEN'))::int AS admin_hidden,
          (count(*) FILTER (WHERE r.created_at >= now() - interval '30 days'))::int AS last_30d,
          avg(r.rating) FILTER (
            WHERE r.created_at >= now() - interval '30 days'
              AND r.moderation_status::text IN ('VISIBLE', 'ADMIN_RESTORED')
          ) AS avg_30d
        FROM reviews r
      `),
      db.query(
        `SELECT count(DISTINCT review_id)::int AS n FROM review_reports WHERE resolved_at IS NULL`
      ),
      db.query(`
        SELECT d::date AS day, count(r.id)::int AS n
        FROM generate_series(current_date - 6, current_date, interval '1 day') d
        LEFT JOIN reviews r ON r.created_at >= d AND r.created_at < d + interval '1 day'
        GROUP BY 1
        ORDER BY 1
      `),
    ])

    const m = main.rows[0]
    const counts: ReviewCounts = {
      flagged: flagged.rows[0].n,
      autoHidden: m.auto_hidden,
      adminHidden: m.admin_hidden,
      total: m.total,
      last30d: m.last_30d,
      avgRating30d: m.avg_30d === null ? null : Math.round(Number(m.avg_30d) * 100) / 100,
      sparkline7d: spark.rows.map((r) => r.n),
    }
    return NextResponse.json(counts)
  } catch (err) {
    return reviewErrorResponse(err, '[GET /api/admin/reviews/counts]')
  }
}