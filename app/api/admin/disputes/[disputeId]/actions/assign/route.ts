// app/api/admin/disputes/[disputeId]/actions/assign/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { isUuid } from '@/lib/workers-api'
import { isActiveDispute } from '@/lib/dispute-constants'
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
  const guard = await requirePermission('disputes:assign')
  if (!guard.ok) return guard.response

  const { disputeId } = await params
  if (!isUuid(disputeId)) return disputeNotFound()

  const body = await req.json().catch(() => ({}))
  const action = body.action === 'claim' || body.action === 'release' ? body.action : null
  if (!action) {
    return NextResponse.json({ error: 'action must be "claim" or "release"' }, { status: 400 })
  }

  const adminId = guard.admin.adminId
  const isSuper = guard.admin.role === 'SUPER_ADMIN'

  try {
    const result = await withTx(async (client) => {
      const { rows } = await client.query(
        `SELECT status::text AS status, assigned_to, is_escalated
         FROM disputes WHERE id = $1 FOR UPDATE`,
        [disputeId]
      )
      if (rows.length === 0) throw new DisputeActionError(404, 'Dispute not found')
      const d = rows[0]

      if (!isActiveDispute(d.status)) {
        throw new DisputeActionError(409, 'This dispute is already resolved.')
      }

      if (action === 'claim') {
        if (d.is_escalated && !isSuper) {
          throw new DisputeActionError(403, 'Only a Super Admin can take an escalated dispute.')
        }
        if (d.assigned_to && d.assigned_to !== adminId && !isSuper) {
          throw new DisputeActionError(409, 'Another admin already has this dispute.')
        }
        await client.query(
          `UPDATE disputes SET assigned_to = $2, assigned_at = now(), updated_at = now() WHERE id = $1`,
          [disputeId, adminId]
        )
      } else {
        if (!d.assigned_to) throw new DisputeActionError(409, 'This dispute is not assigned.')
        if (d.assigned_to !== adminId && !isSuper) {
          throw new DisputeActionError(403, 'Only the assigned admin can release this dispute.')
        }
        await client.query(
          `UPDATE disputes SET assigned_to = NULL, assigned_at = NULL, updated_at = now() WHERE id = $1`,
          [disputeId]
        )
      }
      return { previousAssignee: d.assigned_to as string | null }
    })

    await logAdminAction({
      adminId,
      adminEmail: guard.admin.adminEmail,
      action: action === 'claim' ? 'dispute.claimed' : 'dispute.released',
      resourceType: 'dispute',
      resourceId: disputeId,
      oldValue: { assignedTo: result.previousAssignee },
      newValue: { assignedTo: action === 'claim' ? adminId : null },
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return disputeErrorResponse(err, '[POST dispute assign]')
  }
}