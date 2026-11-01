// app/api/admin/workers/[workerId]/actions/suspend/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { isUuid, workerNotFound } from '@/lib/workers-api'
import { workerSvc } from '@/lib/services/worker'
import { searchSvc } from '@/lib/services/search'
import { serviceErrorResponse } from '@/lib/internal-client'

const DURATIONS: Record<string, number> = { '7d': 7, '30d': 30 }
const MAX_DAYS = 365

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workerId: string }> }
) {
  const guard = await requirePermission('workers:suspend')
  if (!guard.ok) return guard.response

  const { workerId } = await params
  if (!isUuid(workerId)) return workerNotFound()

  const body = await req.json().catch(() => ({}))
  const reason: string = body.reason?.trim()
  const duration: string = body.duration // '7d' | '30d' | 'custom'
  if (!reason) return NextResponse.json({ error: 'A reason is required' }, { status: 400 })

  let until: Date
  if (duration === 'custom') {
    until = new Date(String(body.until ?? ''))
    if (Number.isNaN(until.getTime())) {
      return NextResponse.json({ error: 'A valid end date is required' }, { status: 400 })
    }
    if (until.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'The end date must be in the future' }, { status: 400 })
    }
    if (until.getTime() > Date.now() + MAX_DAYS * 86_400_000) {
      return NextResponse.json({ error: `A suspension can last at most ${MAX_DAYS} days` }, { status: 400 })
    }
  } else if (DURATIONS[duration]) {
    until = new Date(Date.now() + DURATIONS[duration] * 86_400_000)
  } else {
    return NextResponse.json({ error: 'Invalid duration' }, { status: 400 })
  }

  const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }

  try {
    await workerSvc.moderate(workerId, admin, { action: 'suspend', reason, until: until.toISOString() })
    void searchSvc.reindexWorker(workerId)

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'worker.suspended',
      resourceType: 'worker',
      resourceId: workerId,
      newValue: { suspendedUntil: until.toISOString(), reason },
      notes: reason,
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })
    return NextResponse.json({ ok: true, suspendedUntil: until.toISOString() })
  } catch (err) {
    return serviceErrorResponse(err, '[POST worker suspend]')
  }
}