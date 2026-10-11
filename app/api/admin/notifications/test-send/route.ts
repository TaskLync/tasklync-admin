// app/api/admin/notifications/test-send/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { launchDirectBroadcast } from '@/lib/direct-broadcast-engine'
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

    // Resolve target to user/worker ID
    const resolved = await resolveRecipients(audienceType, [rawTarget])
    if (resolved.matched.length === 0) {
      throw new NotificationActionError(
        404,
        `No ${audienceType === 'workers' ? 'worker' : 'customer'} found matching "${rawTarget}". Make sure this account exists.`
      )
    }

    const targetUser = resolved.matched[0]
    const segmentFilter =
      audienceType === 'workers' ? { worker_ids: [targetUser.id] } : { user_ids: [targetUser.id] }

    const result = await launchDirectBroadcast({
      title: `[TEST] ${body.label || 'Test Push Notification'} (${new Date().toLocaleTimeString('en-PK')})`,
      template_key: message.templateKey,
      template_data: message.templateData,
      channels,
      category: 'platform', // Test sends use platform category to bypass marketing opt-out
      segment_type: 'custom_ids',
      segment_filter: segmentFilter,
      created_by: guard.admin.adminId,
    })

    await logAdminAction({
      adminId: guard.admin.adminId,
      adminEmail: guard.admin.adminEmail,
      action: 'notification.test_dispatched',
      resourceType: 'broadcast_campaign',
      resourceId: result.campaign_id,
      newValue: {
        recipientId: targetUser.id,
        recipientName: targetUser.name,
        channels,
        templateKey: message.templateKey,
        pushDelivered: result.pushDelivered,
        pushFailed: result.pushFailed,
        noTokenCount: result.noTokenCount,
      },
      notes: `Test push sent to ${targetUser.name || targetUser.phone || targetUser.id}`,
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    const hasPushToken = Boolean(targetUser.hasFcmToken)
    let deliveryNote = 'Notification delivered directly to in-app feed inbox.'
    if (channels.includes('push')) {
      if (result.pushDelivered > 0) {
        deliveryNote = 'Direct Push notification delivered to device successfully!'
      } else if (!hasPushToken || result.noTokenCount > 0) {
        deliveryNote =
          'Feed item created, but this account has no active FCM device token in the database. Log into the mobile app on the phone to register a token.'
      } else if (result.pushFailed > 0) {
        deliveryNote =
          'Push dispatch was rejected by Firebase (device token may be expired or uninstalled). The dead token has been cleaned up.'
      }
    }

    return NextResponse.json({
      success: true,
      campaignId: result.campaign_id,
      recipient: targetUser,
      channels,
      pushDelivered: result.pushDelivered,
      pushFailed: result.pushFailed,
      deliveryNote,
    })
  } catch (err) {
    return notificationsErrorResponse(err, '[POST /api/admin/notifications/test-send]')
  }
}
