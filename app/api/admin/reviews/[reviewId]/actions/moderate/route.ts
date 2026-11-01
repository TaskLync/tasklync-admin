// app/api/admin/reviews/[reviewId]/actions/moderate/route.ts
// hide -> ADMIN_HIDDEN | restore -> ADMIN_RESTORED | dismiss -> "keep review"
// review-service does the change and emits review.moderated (ratings + search update).
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import {
  MODERATION_ACTIONS, NOTE_MAX_LENGTH, resultingStatus, type ModerationAction,
} from '@/lib/review-constants'
import { isUuid, reviewNotFound } from '@/lib/reviews-api'
import { reviewSvc } from '@/lib/services/review'
import { serviceErrorResponse } from '@/lib/internal-client'

const AUDIT_ACTION: Record<ModerationAction, string> = {
  hide: 'review.hidden',
  restore: 'review.restored',
  dismiss: 'review.reports_dismissed',
}

const BLOCKED_MESSAGE: Record<ModerationAction, string> = {
  hide: 'This review is already hidden.',
  restore: 'This review is already visible, so there is nothing to restore.',
  dismiss: 'This review was hidden by an admin. Use Restore to bring it back.',
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  const guard = await requirePermission('reviews:moderate')
  if (!guard.ok) return guard.response

  const { reviewId } = await params
  if (!isUuid(reviewId)) return reviewNotFound()

  const body = await req.json().catch(() => ({}))
  const action = String(body.action ?? '') as ModerationAction
  const note = String(body.note ?? '').trim()

  if (!(MODERATION_ACTIONS as readonly string[]).includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
  if (!note) return NextResponse.json({ error: 'A reason is required' }, { status: 400 })
  if (note.length > NOTE_MAX_LENGTH) {
    return NextResponse.json({ error: 'Reason is too long (max 1000 characters)' }, { status: 400 })
  }

  const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }

  try {
    const cur = await db.query(
      `SELECT moderation_status::text AS status,
              (SELECT count(*) FROM review_reports rr WHERE rr.review_id = r.id AND rr.resolved_at IS NULL)::int AS open_reports
         FROM reviews r WHERE r.id = $1`,
      [reviewId]
    )
    if (cur.rows.length === 0) return reviewNotFound()
    const current = cur.rows[0].status as string

    const next = resultingStatus(action, current)
    if (!next) return NextResponse.json({ error: BLOCKED_MESSAGE[action] }, { status: 409 })
    if (next === current && cur.rows[0].open_reports === 0) {
      return NextResponse.json({ error: 'There are no open reports on this review.' }, { status: 409 })
    }

    await reviewSvc.moderate(reviewId, admin, { action, note })

    // Make sure the Flagged queue clears even if review-service does not touch the admin columns.
    const resolved = await db.query(
      `UPDATE review_reports SET resolved_at = now(), resolved_by = $2
        WHERE review_id = $1 AND resolved_at IS NULL`,
      [reviewId, admin.id]
    )

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: AUDIT_ACTION[action],
      resourceType: 'review',
      resourceId: reviewId,
      oldValue: { moderationStatus: current },
      newValue: { moderationStatus: next, resolvedReports: resolved.rowCount ?? 0 },
      notes: note,
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    return NextResponse.json({ ok: true, moderationStatus: next, resolvedReports: resolved.rowCount ?? 0 })
  } catch (err) {
    return serviceErrorResponse(err, '[POST review moderate]')
  }
}