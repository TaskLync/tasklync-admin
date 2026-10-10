// app/api/admin/workers/[workerId]/verification/cnic/route.ts
// Admin types the CNIC number read from the image. We validate (13 digits),
// store it, and run the duplicate check against every other worker account.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { isUuid, workerNotFound } from '@/lib/workers-api'
import { CNIC_RE, normalizeCnic } from '@/lib/verification-constants'
import { CNIC_DUPLICATES_SQL } from '@/lib/verification-api'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ workerId: string }> }
) {
  const guard = await requirePermission('workers:verify')
  if (!guard.ok) return guard.response

  const { workerId } = await params
  if (!isUuid(workerId)) return workerNotFound()

  const body = await req.json().catch(() => ({}))
  const digits = normalizeCnic(String(body.cnicNumber ?? ''))
  if (digits && !CNIC_RE.test(digits)) {
    return NextResponse.json({ error: 'CNIC must be exactly 13 digits' }, { status: 400 })
  }

  try {
    const { rows: before } = await db.query(
      `SELECT cnic_number FROM workers WHERE id = $1 AND deleted_at IS NULL`,
      [workerId]
    )
    if (before.length === 0) return workerNotFound()

    await db.query(`UPDATE workers SET cnic_number = $2, updated_at = now() WHERE id = $1`, [
      workerId,
      digits || null,
    ])

    const dupes = digits ? (await db.query(CNIC_DUPLICATES_SQL, [digits, workerId])).rows : []

    await logAdminAction({
      adminId: guard.admin.adminId,
      adminEmail: guard.admin.adminEmail,
      action: 'worker.verification_cnic_saved',
      resourceType: 'worker',
      resourceId: workerId,
      oldValue: { cnicNumber: before[0].cnic_number },
      newValue: { cnicNumber: digits || null, duplicates: dupes.length },
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    return NextResponse.json({
      cnicNumber: digits || null,
      duplicates: dupes.map((r: any) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        verificationStatus: r.verification_status,
      })),
    })
  } catch (err) {
    console.error('[PATCH worker verification cnic]', err)
    return NextResponse.json({ error: 'Failed to save CNIC' }, { status: 500 })
  }
}