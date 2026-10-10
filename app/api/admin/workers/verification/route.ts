// app/api/admin/workers/verification/route.ts
// Queue list for one tab. (Static segment, so it wins over [workerId].)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import {
  QUEUE_BASE_CTE,
  TAB_ORDER,
  TAB_SQL,
  buildQueueFilters,
  parseTab,
} from '@/lib/verification-api'

export async function GET(req: NextRequest) {
  const guard = await requirePermission('workers:verify')
  if (!guard.ok) return guard.response

  const sp = req.nextUrl.searchParams
  const tab = parseTab(sp.get('tab'))
  const { filterSql, params } = buildQueueFilters(sp)

  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '20', 10) || 20))
  const offset = (page - 1) * pageSize

  const where = `WHERE ${TAB_SQL[tab]}${filterSql}`
  const listSql = `
    ${QUEUE_BASE_CTE}
    SELECT * FROM q
    ${where}
    ORDER BY ${TAB_ORDER[tab]}
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `
  const countSql = `${QUEUE_BASE_CTE} SELECT count(*)::int AS total FROM q ${where}`

  try {
    const [listRes, countRes] = await Promise.all([
      db.query(listSql, [...params, pageSize, offset]),
      db.query(countSql, params),
    ])

    const data = listRes.rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      city: r.city,
      avatarUrl: r.avatar_url,
      categories: r.categories,
      verificationStatus: r.verification_status,
      submittedAt: r.submitted_at,
      pendingDocs: r.pending_docs,
      totalDocs: r.total_docs,
      isResubmission: r.is_resubmission,
      lastDecision: r.last_decision,
      lastReasonCode: r.last_reason_code,
      lastNote: r.last_note,
      lastAdminEmail: r.last_admin_email,
      lastDecisionAt: r.last_decision_at,
    }))

    const total = countRes.rows[0]?.total ?? 0
    return NextResponse.json({
      data,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    })
  } catch (err) {
    console.error('[GET /api/admin/workers/verification]', err)
    return NextResponse.json({ error: 'Failed to load verification queue' }, { status: 500 })
  }
}