// app/api/admin/notifications/campaigns/[campaignId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { isUuid } from '@/lib/workers-api'
import {
  CAMPAIGN_COLUMNS_SQL,
  CAMPAIGN_FROM_SQL,
  mapCampaignRow,
  notificationsErrorResponse,
} from '@/lib/notifications-api'
import type { CampaignDetail } from '@/types/notification'

export const dynamic = 'force-dynamic'

const notFound = () => NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const guard = await requirePermission('notifications:view')
  if (!guard.ok) return guard.response

  const { campaignId } = await params
  if (!isUuid(campaignId)) return notFound()

  try {
    const campaignRes = await db.query(
      `SELECT ${CAMPAIGN_COLUMNS_SQL}, c.template_data
       ${CAMPAIGN_FROM_SQL}
       WHERE c.id = $1`,
      [campaignId]
    )
    if (campaignRes.rows.length === 0) return notFound()

    const [deliveries, feed, errors] = await Promise.all([
      db.query(
        `SELECT d.channel::text AS channel, d.status::text AS status, count(*)::int AS count
         FROM notification_deliveries d
         JOIN notifications n ON n.id = d.notification_id
         WHERE n.campaign_id = $1
         GROUP BY 1, 2
         ORDER BY 1, 2`,
        [campaignId]
      ),
      db.query(
        `SELECT
           count(*)::int AS total,
           (count(*) FILTER (WHERE n.is_read))::int AS read,
           (count(*) FILTER (WHERE EXISTS (
              SELECT 1 FROM notification_deliveries d WHERE d.notification_id = n.id
           )))::int AS with_delivery
         FROM notifications n
         WHERE n.campaign_id = $1`,
        [campaignId]
      ),
      db.query(
        `SELECT d.channel::text AS channel, left(d.error_message, 160) AS error, count(*)::int AS count
         FROM notification_deliveries d
         JOIN notifications n ON n.id = d.notification_id
         WHERE n.campaign_id = $1 AND d.status::text = 'FAILED'
         GROUP BY 1, 2
         ORDER BY 3 DESC
         LIMIT 5`,
        [campaignId]
      ),
    ])

    const r = campaignRes.rows[0]
    const f = feed.rows[0]
    const body: CampaignDetail = {
      ...mapCampaignRow(r),
      templateData: r.template_data ?? {},
      deliveries: deliveries.rows,
      feed: { total: f.total, read: f.read, withDelivery: f.with_delivery },
      errors: errors.rows,
    }
    return NextResponse.json(body)
  } catch (err) {
    return notificationsErrorResponse(err, '[GET /api/admin/notifications/campaigns/:id]')
  }
}