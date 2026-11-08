import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { promotionSvc } from '@/lib/services/booking'
import { serviceErrorResponse } from '@/lib/internal-client'
import { ACTIONS, PAST, REASON_REQUIRED, isAction, mapPromotion } from '@/lib/promotions-api'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ promotionId: string; action: string }> }) {
  const { promotionId, action } = await params
  if (!isAction(action)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const guard = await requirePermission(ACTIONS[action])
  if (!guard.ok) return guard.response

  const body = await req.json().catch(() => ({}))
  const reason = String(body.reason ?? '').trim()
  if (REASON_REQUIRED.includes(action) && reason.length < 3) {
    return NextResponse.json({ error: 'A reason is required' }, { status: 400 })
  }

  const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = (await promotionSvc.action(promotionId, action, admin, { reason: reason || undefined })) as any
    await logAdminAction({
      adminId: admin.id, adminEmail: admin.email, action: `promotion.${PAST[action]}`, resourceType: 'promotion',
      resourceId: promotionId, newValue: { status: row?.status }, notes: reason || undefined,
      ip: getClientIp(req), userAgent: req.headers.get('user-agent') ?? undefined,
    })
    return NextResponse.json({ data: row?.id ? mapPromotion(row) : null })
  } catch (err) {
    return serviceErrorResponse(err, `[POST promotion ${action}]`)
  }
}