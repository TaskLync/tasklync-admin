// app/api/admin/workers/[workerId]/actions/reject-verification/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { isUuid, workerNotFound } from '@/lib/workers-api'
import { REJECTION_CODES, rejectionLabel } from '@/lib/verification-constants'
import { VerificationError, enqueueEvent, errorResponse, withTx } from '@/lib/verification-api'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workerId: string }> }
) {
  const guard = await requirePermission('workers:verify')
  if (!guard.ok) return guard.response

  const { workerId } = await params
  if (!isUuid(workerId)) return workerNotFound()

  const body = await req.json().catch(() => ({}))
  const reasonCode = String(body.reasonCode ?? '')
  const note = String(body.note ?? '').trim()
  const allowResubmission = body.allowResubmission !== false // default true

  if (!REJECTION_CODES.includes(reasonCode)) {
    return NextResponse.json({ error: 'Pick a rejection reason' }, { status: 400 })
  }
  if (!note) {
    return NextResponse.json({ error: 'A note for the worker is required' }, { status: 400 })
  }
  if (note.length > 1000) {
    return NextResponse.json({ error: 'Note is too long (max 1000 characters)' }, { status: 400 })
  }

  try {
    await withTx(async (client) => {
      const { rows } = await client.query(
        `SELECT verification_status::text AS verification_status
         FROM workers
         WHERE id = $1 AND deleted_at IS NULL
         FOR UPDATE`,
        [workerId]
      )
      if (rows.length === 0) throw new VerificationError(404, 'Worker not found')
      if (rows[0].verification_status !== 'PENDING_REVIEW') {
        throw new VerificationError(
          409,
          'This worker is not awaiting review. Someone may have already decided.'
        )
      }

      // The note goes on every pending document: worker-service already
      // returns worker_documents.rejection_note to the app.
      await client.query(
        `UPDATE worker_documents
         SET status = 'REJECTED', rejection_note = $2,
             reviewed_by = $3, reviewed_at = now()
         WHERE worker_id = $1 AND status = 'PENDING'`,
        [workerId, note, guard.admin.adminId]
      )

      await client.query(
        `UPDATE workers
         SET verification_status = 'REJECTED',
             verification_rejection_code = $2,
             verification_rejection_note = $3,
             verification_resubmission_allowed = $4,
             is_featured = false,
             featured_at = NULL,
             updated_at = now()
         WHERE id = $1`,
        [workerId, reasonCode, note, allowResubmission]
      )

      await client.query(
        `INSERT INTO worker_verification_reviews
           (worker_id, decision, reason_code, note, allow_resubmission, admin_id, admin_email)
         VALUES ($1, 'rejected', $2, $3, $4, $5, $6)`,
        [workerId, reasonCode, note, allowResubmission, guard.admin.adminId, guard.admin.adminEmail]
      )

      await enqueueEvent(client, {
        topic: 'worker.events',
        eventType: 'worker.rejected',
        workerId,
        data: {
          reason_code: reasonCode,
          reason_label: rejectionLabel(reasonCode),
          note,
          allow_resubmission: allowResubmission,
        },
      })
    })

    await logAdminAction({
      adminId: guard.admin.adminId,
      adminEmail: guard.admin.adminEmail,
      action: 'worker.verification_rejected',
      resourceType: 'worker',
      resourceId: workerId,
      oldValue: { verificationStatus: 'PENDING_REVIEW' },
      newValue: { verificationStatus: 'REJECTED', reasonCode, allowResubmission, note },
      notes: note,
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err, '[POST reject-verification]')
  }
}