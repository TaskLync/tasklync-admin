// app/api/admin/notifications/test-send/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { launchBroadcast } from '@/lib/notification-service'
import {
  NotificationActionError,
  notificationsErrorResponse,
  parseChannels,
  parseMessage,
  resolveRecipients,
} from '@/lib/notifications-api'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const guard = await requirePermission('notifications:send')
  if (!guard.ok) return guard.response

  const body = await req.json().catch(() => ({}))

  try {
    const rawTarget = String(body.target ?? '').trim()
    if (!rawTarget) {
      throw new NotificationActionError(400, 'Enter a phone number, email, or user UUID for the test recipient.')
    }

    const audienceType = body.audience === 'workers' ? 'workers' : 'users'
    const channels = parseChannels(body.channels ?? ['push'])
    const message = parseMessage(body.message, channels)

    const resolved = await resolveRecipients(audienceType, [rawTarget])
    if (resolved.matched.length === 0) {
      throw new NotificationActionError(
        404,
        `No ${audienceType === 'workers' ? 'worker' : 'customer'} found matching "${rawTarget}".`
      )
    }
    const target = resolved.matched[0]

    const result = await launchBroadcast({
      title: `[TEST] ${body.label || 'Test notification'} (${new Date().toISOString().slice(0, 16)})`,
      template_key: message.templateKey,
      template_data: message.templateData,
      channels,
      category: 'platform', // test sends use the operational category so marketing opt-outs do not hide them
      segment_type: 'custom_ids',
      segment_filter: audienceType === 'workers' ? { worker_ids: [target.id] } : { user_ids: [target.id] },
      created_by: guard.admin.adminId,
    })

    await logAdminAction({
      adminId: guard.admin.adminId,
      adminEmail: guard.admin.adminEmail,
      action: 'notification.test_dispatched',
      resourceType: 'broadcast_campaign',
      resourceId: result.campaign_id,
      newValue: { recipientId: target.id, channels, templateKey: message.templateKey },
      notes: `Test sent to ${target.name || target.phone || target.id}`,
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    const noToken = channels.includes('push') && !target.hasFcmToken
    return NextResponse.json({
      success: true,
      campaignId: result.campaign_id,
      recipient: target,
      channels,
      pushDelivered: null,
      pushFailed: null,
      deliveryNote: noToken
        ? 'Queued, but this account has no device token yet, so no push can arrive. Open the app on the phone once.'
        : 'Queued. Open the campaign in History to see the delivery result.',
    })
  } catch (err) {
    return notificationsErrorResponse(err, '[POST /api/admin/notifications/test-send]')
  }
}