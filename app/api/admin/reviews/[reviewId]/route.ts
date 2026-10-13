// app/api/admin/reviews/[reviewId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import {
  BURST_ONE_STAR_SQL,
  SHORT_ONE_STAR_SQL,
  isUuid,
  reviewErrorResponse,
  reviewNotFound,
} from '@/lib/reviews-api'
import type { ReviewSignal } from '@/lib/review-constants'
import type { ReviewActivityRow, ReviewDetail, ReviewReportRow } from '@/types/review'

export const dynamic = 'force-dynamic'

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  const guard = await requirePermission('reviews:view')
  if (!guard.ok) return guard.response

  const { reviewId } = await params
  if (!isUuid(reviewId)) return reviewNotFound()

  try {
    const { rows } = await db.query(
      `SELECT
         r.id, r.booking_id, r.rating, r.comment, r.tags, r.photo_urls,
         r.worker_reply, r.worker_replied_at, r.moderation_status::text AS moderation_status,
         r.report_count, r.edited_at, r.created_at, r.updated_at,
         r.moderated_at, r.moderation_note, mb.full_name AS moderated_by_name,
         rb.review_deadline, rb.category_id, c.name AS category_name,
         b.status::text AS booking_status, b.estimated_total, b.currency,
         b.scheduled_at, b.completed_at,
         u.id AS user_id, u.name AS user_name, u.phone AS user_phone,
         u.avatar_url AS user_avatar, u.warning_count AS user_warning_count,
         w.id AS worker_id, w.name AS worker_name, w.phone AS worker_phone,
         w.avatar_url AS worker_avatar, w.city AS worker_city, w.avg_rating, w.total_reviews,
         (SELECT count(*) FROM reviews x WHERE x.user_id = r.user_id)::int AS user_reviews_written,
         (SELECT avg(x.rating) FROM reviews x WHERE x.user_id = r.user_id) AS user_avg_given,
         (SELECT count(*) FROM reviews x
            WHERE x.user_id = r.user_id AND x.rating = 1
              AND x.created_at >= now() - interval '30 days')::int AS user_one_star_30d,
         (SELECT count(*) FROM review_reports rr
            WHERE rr.review_id = r.id AND rr.resolved_at IS NULL)::int AS open_report_count,
         ${SHORT_ONE_STAR_SQL} AS sig_short,
         ${BURST_ONE_STAR_SQL} AS sig_burst
       FROM reviews r
       LEFT JOIN reviewable_bookings rb ON rb.booking_id = r.booking_id
       LEFT JOIN bookings b             ON b.id = r.booking_id
       LEFT JOIN users u                ON u.id = r.user_id
       LEFT JOIN workers w              ON w.id = r.worker_id
       LEFT JOIN categories c           ON c.id = rb.category_id
       LEFT JOIN admin_users mb         ON mb.id = r.moderated_by
       WHERE r.id = $1`,
      [reviewId]
    )
    if (rows.length === 0) return reviewNotFound()
    const r = rows[0]

    const reportsRes = await db.query(
      `SELECT rr.id, rr.reported_by, rr.reporter_role, rr.reason::text AS reason, rr.note,
              rr.created_at, rr.resolved_at,
              COALESCE(uu.name, ww.name) AS reporter_name,
              ab.full_name AS resolved_by_name
       FROM review_reports rr
       LEFT JOIN users uu       ON rr.reporter_role = 'user'   AND uu.id = rr.reported_by
       LEFT JOIN workers ww     ON rr.reporter_role = 'worker' AND ww.id = rr.reported_by
       LEFT JOIN admin_users ab ON ab.id = rr.resolved_by
       WHERE rr.review_id = $1
       ORDER BY rr.created_at DESC`,
      [reviewId]
    )
    const reports: ReviewReportRow[] = reportsRes.rows.map((x) => ({
      id: x.id,
      reporterId: x.reported_by,
      reporterRole: x.reporter_role,
      reporterName: x.reporter_name,
      reason: x.reason,
      note: x.note,
      createdAt: x.created_at,
      resolvedAt: x.resolved_at,
      resolvedByName: x.resolved_by_name,
    }))

    const activityRes = await db.query(
      `SELECT id, admin_email, action, notes, created_at
       FROM admin_audit_log
       WHERE resource_type = 'review' AND resource_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [reviewId]
    )
    const activity: ReviewActivityRow[] = activityRes.rows.map((x) => ({
      id: x.id,
      adminEmail: x.admin_email,
      action: x.action,
      notes: x.notes,
      createdAt: x.created_at,
    }))

    const signals: ReviewSignal[] = []
    if (r.sig_short) signals.push('short_one_star')
    if (r.sig_burst) signals.push('burst_one_star')

    const detail: ReviewDetail = {
      id: r.id,
      bookingId: r.booking_id,
      rating: r.rating,
      comment: r.comment,
      tags: r.tags ?? [],
      photoUrls: r.photo_urls ?? [],
      workerReply: r.worker_reply,
      workerRepliedAt: r.worker_replied_at,
      moderationStatus: r.moderation_status,
      reportCount: r.report_count,
      openReportCount: r.open_report_count,
      signals,
      editedAt: r.edited_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      moderatedAt: r.moderated_at,
      moderatedByName: r.moderated_by_name,
      moderationNote: r.moderation_note,
      booking: {
        id: r.booking_id,
        status: r.booking_status,
        categoryId: r.category_id,
        categoryName: r.category_name,
        scheduledAt: r.scheduled_at,
        completedAt: r.completed_at,
        estimatedTotal: num(r.estimated_total),
        currency: r.currency ?? 'PKR',
        reviewDeadline: r.review_deadline,
      },
      reviewer: {
        id: r.user_id,
        name: r.user_name,
        phone: r.user_phone,
        avatarUrl: r.user_avatar,
        warningCount: r.user_warning_count ?? 0,
        reviewsWritten: r.user_reviews_written,
        avgGiven: r.user_avg_given === null ? null : Math.round(Number(r.user_avg_given) * 10) / 10,
        oneStar30d: r.user_one_star_30d,
      },
      worker: {
        id: r.worker_id,
        name: r.worker_name,
        phone: r.worker_phone,
        avatarUrl: r.worker_avatar,
        city: r.worker_city,
        avgRating: Number(r.avg_rating ?? 0),
        totalReviews: r.total_reviews ?? 0,
      },
      reports,
      activity,
    }

    return NextResponse.json(detail)
  } catch (err) {
    return reviewErrorResponse(err, '[GET /api/admin/reviews/[reviewId]]')
  }
}