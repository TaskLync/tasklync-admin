// app/api/admin/notifications/audience/estimate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import {
  estimateAudience,
  notificationsErrorResponse,
  parseAudience,
  parseCategory,
} from '@/lib/notifications-api'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const guard = await requirePermission('notifications:send')
  if (!guard.ok) return guard.response

  const body = await req.json().catch(() => ({}))

  try {
    const audience = parseAudience(body.audience)
    const category = parseCategory(body.category)
    return NextResponse.json(await estimateAudience(audience, category))
  } catch (err) {
    return notificationsErrorResponse(err, '[POST /api/admin/notifications/audience/estimate]')
  }
}