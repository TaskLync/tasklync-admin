// lib/direct-broadcast-engine.ts
// Enterprise-grade direct push broadcast engine for TaskLync Admin.
// Bypasses fragile external gateway hops and dispatches FCM v1 notifications directly
// while maintaining full auditability across PostgreSQL notifications & notification_deliveries tables.
import { db } from '@/lib/db'
import {
  CUSTOM_TEMPLATE_KEY,
  DEFAULT_DEEP_LINK,
  type BroadcastCategory,
  type DeliveryChannel,
  type SegmentType,
} from '@/lib/notification-constants'
import { parseTemplateKey, previewTemplate } from '@/lib/notification-catalog'
import { sendDirectPush } from '@/lib/firebase-admin'

export interface DirectBroadcastInput {
  title: string
  template_key: string
  template_data: Record<string, unknown>
  channels: DeliveryChannel[]
  category: BroadcastCategory
  segment_type: SegmentType
  segment_filter: Record<string, unknown>
  created_by: string
}

export interface DirectBroadcastResult {
  campaign_id: string
  status: string
  totalRecipients: number
  sentCount: number
  pushDelivered: number
  pushFailed: number
  noTokenCount: number
  prunedDeadTokens: number
}

interface RecipientRow {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  fcm_token: string | null
  entity_type: 'user' | 'worker'
}

/**
 * Resolves recipient accounts from PostgreSQL based on segment selection.
 */
async function resolveRecipients(
  segmentType: SegmentType,
  filter: Record<string, unknown>
): Promise<RecipientRow[]> {
  switch (segmentType) {
    case 'all_users': {
      const { rows } = await db.query(
        `SELECT id, name, phone, email, fcm_token, 'user' as entity_type
         FROM users WHERE deleted_at IS NULL`
      )
      return rows
    }
    case 'all_workers': {
      const { rows } = await db.query(
        `SELECT id, name, phone, email, fcm_token, 'worker' as entity_type
         FROM workers WHERE deleted_at IS NULL`
      )
      return rows
    }
    case 'category_city': {
      const { rows } = await db.query(
        `SELECT DISTINCT w.id, w.name, w.phone, w.email, w.fcm_token, 'worker' as entity_type
         FROM workers w
         JOIN worker_skills ws ON ws.worker_id = w.id
         WHERE w.deleted_at IS NULL
           AND w.verification_status::text = 'VERIFIED'
           AND ws.category_id = $1
           AND w.city = $2`,
        [filter.category_id, filter.city]
      )
      return rows
    }
    case 'custom_ids': {
      const userIds = Array.isArray(filter.user_ids) ? filter.user_ids : []
      const workerIds = Array.isArray(filter.worker_ids) ? filter.worker_ids : []

      const recipients: RecipientRow[] = []
      if (userIds.length > 0) {
        const { rows } = await db.query(
          `SELECT id, name, phone, email, fcm_token, 'user' as entity_type
           FROM users WHERE deleted_at IS NULL AND id = ANY($1::uuid[])`,
          [userIds]
        )
        recipients.push(...rows)
      }
      if (workerIds.length > 0) {
        const { rows } = await db.query(
          `SELECT id, name, phone, email, fcm_token, 'worker' as entity_type
           FROM workers WHERE deleted_at IS NULL AND id = ANY($1::uuid[])`,
          [workerIds]
        )
        recipients.push(...rows)
      }
      return recipients
    }
    default:
      return []
  }
}

/**
 * Renders title, body, and deep link for a given template and data.
 */
function renderMessagePayload(
  templateKey: string,
  data: Record<string, unknown>
): { title: string; body: string; deepLink: string; imageUrl?: string | null } {
  if (templateKey === CUSTOM_TEMPLATE_KEY) {
    const rawImage = (data.imageUrl || data.image) as string | undefined
    return {
      title: String(data.title ?? 'TaskLync Notification'),
      body: String(data.body ?? ''),
      deepLink: String(data.deepLink ?? DEFAULT_DEEP_LINK),
      imageUrl: rawImage && typeof rawImage === 'string' && rawImage.trim() ? rawImage.trim() : null,
    }
  }

  const parsed = parseTemplateKey(templateKey)
  if (!parsed) {
    return {
      title: 'TaskLync Notification',
      body: 'You have a new update from TaskLync.',
      deepLink: DEFAULT_DEEP_LINK,
      imageUrl: null,
    }
  }

  const values = data as Record<string, string | number>
  const preview = previewTemplate(parsed.template, parsed.language, values)
  const rawImage = (data.imageUrl || data.image) as string | undefined

  return {
    title: preview.title,
    body: preview.body,
    deepLink: parsed.template.deepLink || DEFAULT_DEEP_LINK,
    imageUrl: rawImage && typeof rawImage === 'string' && rawImage.trim() ? rawImage.trim() : null,
  }
}

/**
 * Launches an end-to-end direct push broadcast directly from tasklync-admin.
 */
export async function launchDirectBroadcast(
  input: DirectBroadcastInput
): Promise<DirectBroadcastResult> {
  const recipients = await resolveRecipients(input.segment_type, input.segment_filter)
  const rendered = renderMessagePayload(input.template_key, input.template_data)

  // 1. Create broadcast campaign record
  const { rows: campaignRows } = await db.query(
    `INSERT INTO broadcast_campaigns
      (title, template_key, template_data, channels, category, segment_type, segment_filter, status, total_recipients, sent_count, created_by, created_at, started_at)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, 'SENDING', $8, 0, $9, NOW(), NOW())
     RETURNING id`,
    [
      input.title,
      input.template_key,
      JSON.stringify(input.template_data),
      input.channels,
      input.category,
      input.segment_type,
      JSON.stringify(input.segment_filter),
      recipients.length,
      input.created_by,
    ]
  )

  const campaignId = campaignRows[0].id

  let pushDelivered = 0
  let pushFailed = 0
  let noTokenCount = 0
  let prunedDeadTokens = 0

  const shouldSendPush = input.channels.includes('push')

  // 2. Fan-out to recipients
  for (const recipient of recipients) {
    // 2a. Insert in-app notifications feed row
    const { rows: notifRows } = await db.query(
      `INSERT INTO notifications
        (recipient_id, recipient_type, category, template_key, title, body, deep_link, template_data, campaign_id, is_read, created_at)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, NOW())
       RETURNING id`,
      [
        recipient.id,
        recipient.entity_type,
        input.category,
        input.template_key,
        rendered.title,
        rendered.body,
        rendered.deepLink,
        JSON.stringify(input.template_data),
        campaignId,
      ]
    )

    const notificationId = notifRows[0]?.id

    // 2b. Push notification dispatch
    if (shouldSendPush) {
      if (!recipient.fcm_token) {
        noTokenCount++
        continue
      }

      const pushResult = await sendDirectPush({
        token: recipient.fcm_token,
        title: rendered.title,
        body: rendered.body,
        imageUrl: rendered.imageUrl,
        deepLink: rendered.deepLink,
        data: {
          campaignId,
          notificationId,
          category: input.category,
          templateKey: input.template_key,
        },
      })

      if (pushResult.success) {
        pushDelivered++
        if (notificationId) {
          await db.query(
            `INSERT INTO notification_deliveries
              (notification_id, channel, status, provider, provider_message_id, attempted_at, delivered_at)
             VALUES
              ($1, 'push', 'SENT', 'fcm', $2, NOW(), NOW())`,
            [notificationId, pushResult.messageId]
          )
        }
      } else {
        pushFailed++
        if (notificationId) {
          await db.query(
            `INSERT INTO notification_deliveries
              (notification_id, channel, status, provider, error_message, attempted_at)
             VALUES
              ($1, 'push', 'FAILED', 'fcm', $2, NOW())`,
            [notificationId, pushResult.error || 'Delivery failed']
          )
        }

        // Auto-prune dead/unregistered tokens so database stays clean
        if (pushResult.isDeadToken) {
          prunedDeadTokens++
          const table = recipient.entity_type === 'worker' ? 'workers' : 'users'
          await db.query(
            `UPDATE ${table} SET fcm_token = NULL, updated_at = NOW() WHERE id = $1`,
            [recipient.id]
          )
        }
      }
    }
  }

  // 3. Mark campaign as COMPLETED
  const totalSent = recipients.length
  await db.query(
    `UPDATE broadcast_campaigns
     SET status = 'COMPLETED', sent_count = $2, total_recipients = $3, completed_at = NOW()
     WHERE id = $1`,
    [campaignId, totalSent, totalSent]
  )

  return {
    campaign_id: campaignId,
    status: 'COMPLETED',
    totalRecipients: recipients.length,
    sentCount: totalSent,
    pushDelivered,
    pushFailed,
    noTokenCount,
    prunedDeadTokens,
  }
}
