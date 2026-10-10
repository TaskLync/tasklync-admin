// app/api/admin/disputes/[disputeId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { isUuid } from '@/lib/workers-api'
import { CITY_SQL } from '@/lib/bookings-api'
import {
  DISPUTE_FROM_SQL,
  RESPONSE_DUE_SQL,
  disputeErrorResponse,
  disputeNotFound,
} from '@/lib/disputes-api'
import { ADMIN_OPENED_PREFIX } from '@/lib/dispute-constants'
import type { DisputeActivityRow, DisputeDetail, DisputeRefundRecord } from '@/types/dispute'

export const dynamic = 'force-dynamic'

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ disputeId: string }> }
) {
  const guard = await requirePermission('disputes:view')
  if (!guard.ok) return guard.response

  const { disputeId } = await params
  if (!isUuid(disputeId)) return disputeNotFound()

  try {
    const { rows } = await db.query(
      `SELECT
         d.id, d.booking_id, d.status::text AS status, d.resolution::text AS resolution,
         d.reason, d.evidence_urls, d.worker_response, d.admin_note, d.refund_amount,
         d.created_at, d.updated_at, d.resolved_at,
         ${RESPONSE_DUE_SQL} AS response_due_at,
         (d.reason LIKE '${ADMIN_OPENED_PREFIX}%') AS opened_by_admin,
         d.is_escalated, d.escalated_at, d.escalation_note,
         d.assigned_to, d.assigned_at, aa.full_name AS assigned_name, aa.email AS assigned_email,
         eb.full_name AS escalated_by_name, rb.full_name AS resolved_by_name,
         b.status::text AS booking_status, b.category_id, c.name AS category_name,
         ${CITY_SQL} AS city,
         b.scheduled_at, b.started_at, b.completed_at,
         b.estimated_total, b.platform_fee, b.worker_amount, b.currency,
         b.is_payment_confirmed, b.payment_intent_id,
         u.id AS user_id, u.name AS user_name, u.phone AS user_phone, u.avatar_url AS user_avatar,
         w.id AS worker_id, w.name AS worker_name, w.phone AS worker_phone,
         w.avatar_url AS worker_avatar, w.avg_rating, w.total_reviews
       ${DISPUTE_FROM_SQL}
       LEFT JOIN admin_users eb ON eb.id = d.escalated_by
       LEFT JOIN admin_users rb ON rb.id = d.resolved_by
       WHERE d.id = $1`,
      [disputeId]
    )
    if (rows.length === 0) return disputeNotFound()
    const r = rows[0]

    // Refund records for this booking (payment-service tables may not exist yet).
    let refundsAvailable = true
    let refunds: DisputeRefundRecord[] = []
    try {
      const refundRes = await db.query(
        `SELECT id, amount, refund_percentage, reason::text AS reason, status::text AS status,
                refund_method::text AS method, gateway_reference, failure_reason,
                initiated_at, completed_at
         FROM refunds
         WHERE booking_id = $1
         ORDER BY initiated_at DESC
         LIMIT 20`,
        [r.booking_id]
      )
      refunds = refundRes.rows.map((x) => ({
        id: x.id,
        amount: Number(x.amount),
        percentage: Number(x.refund_percentage),
        reason: x.reason,
        status: x.status,
        method: x.method,
        gatewayReference: x.gateway_reference,
        failureReason: x.failure_reason,
        initiatedAt: x.initiated_at,
        completedAt: x.completed_at,
      }))
    } catch (err) {
      const code = (err as { code?: string } | null)?.code
      if (code !== '42P01' && code !== '42703') throw err
      refundsAvailable = false
    }

    const activityRes = await db.query(
      `SELECT id, admin_email, action, notes, created_at
       FROM admin_audit_log
       WHERE resource_type = 'dispute' AND resource_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [disputeId]
    )
    const activity: DisputeActivityRow[] = activityRes.rows.map((x) => ({
      id: x.id,
      adminEmail: x.admin_email,
      action: x.action,
      notes: x.notes,
      createdAt: x.created_at,
    }))

    const detail: DisputeDetail = {
      id: r.id,
      bookingId: r.booking_id,
      status: r.status,
      resolution: r.resolution,
      reason: r.reason,
      openedByAdmin: r.opened_by_admin,
      evidenceUrls: r.evidence_urls ?? [],
      workerResponse: r.worker_response,
      adminNote: r.admin_note,
      refundAmount: num(r.refund_amount),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      resolvedAt: r.resolved_at,
      resolvedByName: r.resolved_by_name,
      responseDueAt: r.response_due_at,
      isEscalated: r.is_escalated,
      escalatedAt: r.escalated_at,
      escalatedByName: r.escalated_by_name,
      escalationNote: r.escalation_note,
      assignedTo: r.assigned_to
        ? { id: r.assigned_to, name: r.assigned_name, email: r.assigned_email }
        : null,
      assignedAt: r.assigned_at,
      assignedToMe: r.assigned_to === guard.admin.adminId,
      booking: {
        id: r.booking_id,
        status: r.booking_status,
        categoryId: r.category_id,
        categoryName: r.category_name,
        city: r.city,
        scheduledAt: r.scheduled_at,
        startedAt: r.started_at,
        completedAt: r.completed_at,
        estimatedTotal: Number(r.estimated_total),
        platformFee: Number(r.platform_fee),
        workerAmount: Number(r.worker_amount),
        currency: r.currency,
        isPaymentConfirmed: r.is_payment_confirmed,
        paymentIntentId: r.payment_intent_id,
      },
      user: {
        id: r.user_id,
        name: r.user_name,
        phone: r.user_phone,
        avatarUrl: r.user_avatar,
      },
      worker: {
        id: r.worker_id,
        name: r.worker_name,
        phone: r.worker_phone,
        avatarUrl: r.worker_avatar,
        avgRating: Number(r.avg_rating ?? 0),
        totalReviews: r.total_reviews ?? 0,
      },
      refundsAvailable,
      refunds,
      activity,
    }

    return NextResponse.json(detail)
  } catch (err) {
    return disputeErrorResponse(err, '[GET /api/admin/disputes/[disputeId]]')
  }
}