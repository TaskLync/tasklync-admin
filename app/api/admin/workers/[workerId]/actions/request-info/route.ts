// app/api/admin/workers/[workerId]/actions/request-info/route.ts
// Asks the worker to clarify something. Status stays PENDING_REVIEW; the
// message is recorded and an event is emitted for notification/chat service.
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { isUuid, workerNotFound } from '@/lib/workers-api'
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
  const message = String(body.message ?? '').trim()
  if (!message) {
    return NextResponse.json({ error: 'A message is required' }, { status: 400 })
  }
  if (message.length > 1000) {
    return NextResponse.json({ error: 'Message is too long (max 1000 characters)' }, { status: 400 })
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
        throw new VerificationError(409, 'This worker is not awaiting review')
      }

      await client.query(
        `INSERT INTO worker_verification_reviews
           (worker_id, decision, note, admin_id, admin_email)
         VALUES ($1, 'info_requested', $2, $3, $4)`,
        [workerId, message, guard.admin.adminId, guard.admin.adminEmail]
      )

      await enqueueEvent(client, {
        topic: 'worker.events',
        eventType: 'worker.verification_info_requested',
        workerId,
        data: { message },
      })
    })

    await logAdminAction({
      adminId: guard.admin.adminId,
      adminEmail: guard.admin.adminEmail,
      action: 'worker.verification_info_requested',
      resourceType: 'worker',
      resourceId: workerId,
      newValue: { message },
      notes: message,
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err, '[POST request-info]')
  }
}