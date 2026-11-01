// app/api/admin/workers/[workerId]/actions/request-info/route.ts
// Status stays PENDING_REVIEW. The worker gets the message as a push + in-app notification.
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { isUuid, workerNotFound } from '@/lib/workers-api'
import { VerificationError, errorResponse, withTx } from '@/lib/verification-api'
import { launchBroadcast } from '@/lib/notification-service'
import { CUSTOM_TEMPLATE_KEY } from '@/lib/notification-constants'

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
  if (!message) return NextResponse.json({ error: 'A message is required' }, { status: 400 })
  if (message.length > 160) {
    return NextResponse.json({ error: 'Message is too long for a push (max 160 characters)' }, { status: 400 })
  }
  if (/["\\]/.test(message)) {
    return NextResponse.json({ error: "Message can't contain double quotes or backslashes" }, { status: 400 })
  }

  try {
    await withTx(async (client) => {
      const { rows } = await client.query(
        `SELECT verification_status::text AS verification_status
           FROM workers WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [workerId]
      )
      if (rows.length === 0) throw new VerificationError(404, 'Worker not found')
      if (rows[0].verification_status !== 'PENDING_REVIEW') {
        throw new VerificationError(409, 'This worker is not awaiting review')
      }
      await client.query(
        `INSERT INTO worker_verification_reviews (worker_id, decision, note, admin_id, admin_email)
         VALUES ($1, 'info_requested', $2, $3, $4)`,
        [workerId, message, guard.admin.adminId, guard.admin.adminEmail]
      )
    })

    let notified = true
    try {
      await launchBroadcast({
        title: `[Verification] more info needed (${new Date().toISOString().slice(0, 16)})`,
        template_key: CUSTOM_TEMPLATE_KEY,
        template_data: {
          title: 'More information needed',
          body: message,
          deepLink: 'tasklync://worker/profile',
        },
        channels: ['push'],
        category: 'platform',
        segment_type: 'custom_ids',
        segment_filter: { worker_ids: [workerId] },
        created_by: guard.admin.adminId,
      })
    } catch (err) {
      notified = false
      console.error('[request-info] notification failed', err)
    }

    await logAdminAction({
      adminId: guard.admin.adminId,
      adminEmail: guard.admin.adminEmail,
      action: 'worker.verification_info_requested',
      resourceType: 'worker',
      resourceId: workerId,
      newValue: { message, notified },
      notes: message,
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    return NextResponse.json({ ok: true, notified })
  } catch (err) {
    return errorResponse(err, '[POST request-info]')
  }
}