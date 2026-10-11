// app/api/admin/notifications/audience/resolve/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { LIMITS } from '@/lib/notification-constants'
import {
  NotificationActionError,
  notificationsErrorResponse,
  resolveRecipients,
} from '@/lib/notifications-api'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const guard = await requirePermission('notifications:send')
  if (!guard.ok) return guard.response

  const body = await req.json().catch(() => ({}))

  try {
    const audience = body.audience === 'workers' ? 'workers' : body.audience === 'users' ? 'users' : null
    if (!audience) throw new NotificationActionError(400, 'Choose users or workers')

    const identifiers: string[] = Array.isArray(body.identifiers)
      ? [...new Set<string>(body.identifiers.map((s: unknown) => String(s).trim()).filter(Boolean))]
      : []
    if (identifiers.length === 0) throw new NotificationActionError(400, 'Paste at least one phone, email or ID')
    if (identifiers.length > LIMITS.specificPeople) {
      throw new NotificationActionError(400, `Paste at most ${LIMITS.specificPeople} recipients at a time`)
    }

    return NextResponse.json(await resolveRecipients(audience, identifiers))
  } catch (err) {
    return notificationsErrorResponse(err, '[POST /api/admin/notifications/audience/resolve]')
  }
}