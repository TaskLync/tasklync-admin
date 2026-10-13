// app/api/admin/reviews/[reviewId]/actions/moderate/route.ts
// hide    -> ADMIN_HIDDEN   (spec: "Remove Review, with reason")
// restore -> ADMIN_RESTORED
// dismiss -> "Keep Review": resolves open reports; an AUTO_HIDDEN review is restored.
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import {
  MODERATION_ACTIONS,
  NOTE_MAX_LENGTH,
  resultingStatus,
  type ModerationAction,
} from '@/lib/review-constants'
import {
  ReviewActionError,
  invalidateReviewCache,
  isUuid,
  reviewErrorResponse,
  reviewNotFound,
  withTx,
} from '@/lib/reviews-api'

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
  if (!note) {
    return NextResponse.json({ error: 'A reason is required' }, { status: 400 })
  }
  if (note.length > NOTE_MAX_LENGTH) {
    return NextResponse.json({ error: 'Reason is too long (max 1000 characters)' }, { status: 400 })
  }

  const adminId = guard.admin.adminId
  const adminEmail = guard.admin.adminEmail

  try {
    const result = await withTx(async (client) => {
      // Lock the row so a concurrent review-service auto-hide can't interleave.
      const { rows } = await client.query(
        `SELECT worker_id, moderation_status::text AS status
         FROM reviews WHERE id = $1 FOR UPDATE`,
        [reviewId]
      )
      if (rows.length === 0) throw new ReviewActionError(404, 'Review not found')

      const current = rows[0].status as string
      const next = resultingStatus(action, current)
      if (!next) throw new ReviewActionError(409, BLOCKED_MESSAGE[action])

      const changed = next !== current
      if (changed) {
        await client.query(
          `UPDATE reviews
           SET moderation_status = $2::moderation_status,
               moderated_by = $3,
               moderated_at = now(),
               moderation_note = $4,
               updated_at = now()
           WHERE id = $1`,
          [reviewId, next, adminId, note]
        )
      }

      const resolved = await client.query(
        `UPDATE review_reports
         SET resolved_at = now(), resolved_by = $2
         WHERE review_id = $1 AND resolved_at IS NULL`,
        [reviewId, adminId]
      )

      if (!changed && (resolved.rowCount ?? 0) === 0) {
        throw new ReviewActionError(409, 'There are no open reports on this review.')
      }

      return {
        workerId: rows[0].worker_id as string | null,
        previous: current,
        next,
        changed,
        resolvedReports: resolved.rowCount ?? 0,
      }
    })

    if (result.changed) await invalidateReviewCache(reviewId, result.workerId)

    await logAdminAction({
      adminId,
      adminEmail,
      action: AUDIT_ACTION[action],
      resourceType: 'review',
      resourceId: reviewId,
      oldValue: { moderationStatus: result.previous },
      newValue: { moderationStatus: result.next, resolvedReports: result.resolvedReports },
      notes: note,
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    return NextResponse.json({
      ok: true,
      moderationStatus: result.next,
      resolvedReports: result.resolvedReports,
    })
  } catch (err) {
    return reviewErrorResponse(err, '[POST review moderate]')
  }
}