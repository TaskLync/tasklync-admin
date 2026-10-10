// app/api/admin/disputes/[disputeId]/actions/escalate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { isUuid } from '@/lib/workers-api'
import { NOTE_MAX_LENGTH, isActiveDispute } from '@/lib/dispute-constants'
import {
  DisputeActionError,
  disputeErrorResponse,
  disputeNotFound,
  withTx,
} from '@/lib/disputes-api'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ disputeId: string }> }
) {
  const guard = await requirePermission('disputes:escalate')
  if (!guard.ok) return guard.response

  const { disputeId } = await params
  if (!isUuid(disputeId)) return disputeNotFound()

  const body = await req.json().catch(() => ({}))
  const note = String(body.note ?? '').trim()
  if (!note) {
    return NextResponse.json({ error: 'Explain why this needs a Super Admin' }, { status: 400 })
  }
  if (note.length > NOTE_MAX_LENGTH) {
    return NextResponse.json({ error: 'Note is too long (max 1000 characters)' }, { status: 400 })
  }

  try {
    await withTx(async (client) => {
      const { rows } = await client.query(
        `SELECT status::text AS status, is_escalated FROM disputes WHERE id = $1 FOR UPDATE`,
        [disputeId]
      )
      if (rows.length === 0) throw new DisputeActionError(404, 'Dispute not found')
      if (!isActiveDispute(rows[0].status)) {
        throw new DisputeActionError(409, 'This dispute is already resolved.')
      }
      if (rows[0].is_escalated) {
        throw new DisputeActionError(409, 'This dispute is already escalated.')
      }

      // disputes.status is deliberately NOT changed (booking-service owns that flow).
      // Assignment is cleared so a Super Admin picks it up from the Escalated tab.
      await client.query(
        `UPDATE disputes
         SET is_escalated = true,
             escalated_at = now(),
             escalated_by = $2,
             escalation_note = $3,
             assigned_to = NULL,
             assigned_at = NULL,
             updated_at = now()
         WHERE id = $1`,
        [disputeId, guard.admin.adminId, note]
      )
    })

    await logAdminAction({
      adminId: guard.admin.adminId,
      adminEmail: guard.admin.adminEmail,
      action: 'dispute.escalated',
      resourceType: 'dispute',
      resourceId: disputeId,
      newValue: { isEscalated: true },
      notes: note,
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return disputeErrorResponse(err, '[POST dispute escalate]')
  }
}