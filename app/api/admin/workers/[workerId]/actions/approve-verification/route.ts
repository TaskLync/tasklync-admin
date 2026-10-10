// app/api/admin/workers/[workerId]/actions/approve-verification/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { isUuid, workerNotFound } from '@/lib/workers-api'
import {
  CNIC_DUPLICATES_SQL,
  VerificationError,
  enqueueEvent,
  errorResponse,
  withTx,
} from '@/lib/verification-api'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workerId: string }> }
) {
  const guard = await requirePermission('workers:verify')
  if (!guard.ok) return guard.response

  const { workerId } = await params
  if (!isUuid(workerId)) return workerNotFound()

  try {
    const result = await withTx(async (client) => {
      // Lock the row so two admins can't decide the same worker at once.
      const { rows } = await client.query(
        `SELECT id, name, verification_status::text AS verification_status,
                banned_at, cnic_number
         FROM workers
         WHERE id = $1 AND deleted_at IS NULL
         FOR UPDATE`,
        [workerId]
      )
      if (rows.length === 0) throw new VerificationError(404, 'Worker not found')
      const w = rows[0]

      if (w.verification_status !== 'PENDING_REVIEW') {
        throw new VerificationError(
          409,
          'This worker is not awaiting review. Someone may have already decided.'
        )
      }
      if (w.banned_at) {
        throw new VerificationError(409, 'Banned workers cannot be verified')
      }

      const docs = await client.query(
        `SELECT type::text AS type, status::text AS status
         FROM worker_documents WHERE worker_id = $1`,
        [workerId]
      )
      const hasIdentityDoc = docs.rows.some(
        (d) => (d.type === 'NATIONAL_ID' || d.type === 'PASSPORT') && d.status !== 'REJECTED'
      )
      if (!hasIdentityDoc) {
        throw new VerificationError(409, 'No identity document (CNIC or passport) on file')
      }

      if (w.cnic_number) {
        const dupes = await client.query(CNIC_DUPLICATES_SQL, [w.cnic_number, workerId])
        if (dupes.rows.length > 0) {
          throw new VerificationError(
            409,
            'Another account uses this CNIC number. Resolve the duplicate before approving.'
          )
        }
      }

      const approved = await client.query(
        `UPDATE worker_documents
         SET status = 'APPROVED', rejection_note = NULL,
             reviewed_by = $2, reviewed_at = now()
         WHERE worker_id = $1 AND status = 'PENDING'`,
        [workerId, guard.admin.adminId]
      )

      await client.query(
        `UPDATE workers
         SET verification_status = 'VERIFIED',
             verified_at = now(),
             verified_by = $2,
             verification_rejection_code = NULL,
             verification_rejection_note = NULL,
             verification_resubmission_allowed = true,
             reverification_requested_at = NULL,
             reverification_reason = NULL,
             updated_at = now()
         WHERE id = $1`,
        [workerId, guard.admin.adminId]
      )

      await client.query(
        `INSERT INTO worker_verification_reviews (worker_id, decision, admin_id, admin_email)
         VALUES ($1, 'approved', $2, $3)`,
        [workerId, guard.admin.adminId, guard.admin.adminEmail]
      )

      await enqueueEvent(client, {
        topic: 'worker.events',
        eventType: 'worker.verified',
        workerId,
        data: { verified_by: guard.admin.adminId },
      })

      return { name: w.name as string | null, approvedDocs: approved.rowCount ?? 0 }
    })

    await logAdminAction({
      adminId: guard.admin.adminId,
      adminEmail: guard.admin.adminEmail,
      action: 'worker.verification_approved',
      resourceType: 'worker',
      resourceId: workerId,
      oldValue: { verificationStatus: 'PENDING_REVIEW' },
      newValue: { verificationStatus: 'VERIFIED', approvedDocuments: result.approvedDocs },
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err, '[POST approve-verification]')
  }
}