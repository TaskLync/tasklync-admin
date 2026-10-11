// app/api/admin/notifications/broadcasts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { hasPermission } from '@/lib/auth/rbac'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { BROAD_SEGMENTS, LIMITS } from '@/lib/notification-constants'
import { launchBroadcast } from '@/lib/notification-service'
import {
  NotificationActionError,
  assertNoRecentDuplicate,
  notificationsErrorResponse,
  parseAudience,
  parseCategory,
  parseChannels,
  parseMessage,
  segmentFilterFor,
} from '@/lib/notifications-api'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const guard = await requirePermission('notifications:send')
  if (!guard.ok) return guard.response

  const body = await req.json().catch(() => ({}))

  try {
    const label = String(body.title ?? '').replace(/\s+/g, ' ').trim()
    if (!label) throw new NotificationActionError(400, 'Give this campaign a name')
    if (label.length > LIMITS.label) {
      throw new NotificationActionError(400, `Campaign name must be ${LIMITS.label} characters or fewer`)
    }

    const audience = parseAudience(body.audience)
    if (
      BROAD_SEGMENTS.includes(audience.segmentType) &&
      !hasPermission(guard.admin.role, 'notifications:broadcast-all')
    ) {
      throw new NotificationActionError(403, 'Only a Super Admin can send to all users or all workers.')
    }

    const channels = parseChannels(body.channels)
    const message = parseMessage(body.message, channels)
    const category = message.category ?? parseCategory(body.category)

    await assertNoRecentDuplicate(message.templateKey)

    const result = await launchBroadcast({
      title: label,
      template_key: message.templateKey,
      template_data: message.templateData,
      channels,
      category,
      segment_type: audience.segmentType,
      segment_filter: segmentFilterFor(audience),
      created_by: guard.admin.adminId,
    })

    await logAdminAction({
      adminId: guard.admin.adminId,
      adminEmail: guard.admin.adminEmail,
      action: 'notification.broadcast_launched',
      resourceType: 'broadcast_campaign',
      resourceId: result.campaign_id,
      newValue: {
        templateKey: message.templateKey,
        category,
        channels,
        segmentType: audience.segmentType,
        recipientsSpecified: audience.segmentType === 'custom_ids' ? audience.ids.length : null,
        acknowledgedQuietHours: body.acknowledgeQuietHours === true,
      },
      notes: label,
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    return NextResponse.json({ campaignId: result.campaign_id, status: result.status }, { status: 202 })
  } catch (err) {
    return notificationsErrorResponse(err, '[POST /api/admin/notifications/broadcasts]')
  }
}