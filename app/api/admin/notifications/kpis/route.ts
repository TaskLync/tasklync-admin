// app/api/admin/notifications/kpis/route.ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { notificationsErrorResponse } from '@/lib/notifications-api'
import type { NotificationKpis } from '@/types/notification'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermission('notifications:view')
  if (!guard.ok) return guard.response

  try {
    const [campaigns, rate] = await Promise.all([
      db.query(`
        SELECT
          (count(*) FILTER (WHERE created_at >= now() - interval '30 days'))::int AS campaigns_30d,
          (count(*) FILTER (WHERE status::text = 'SENDING'))::int AS sending,
          (count(*) FILTER (WHERE status::text = 'FAILED'
                              AND created_at >= now() - interval '30 days'))::int AS failed_30d,
          COALESCE(sum(total_recipients) FILTER (WHERE created_at >= now() - interval '30 days'), 0)::int AS recipients_30d
        FROM broadcast_campaigns
      `),
      db.query(`
        SELECT
          (count(*) FILTER (WHERE d.status::text = 'SENT'))::int AS sent,
          (count(*) FILTER (WHERE d.status::text IN ('SENT', 'FAILED')))::int AS attempted
        FROM notification_deliveries d
        JOIN notifications n ON n.id = d.notification_id
        WHERE n.campaign_id IS NOT NULL AND d.attempted_at >= now() - interval '30 days'
      `),
    ])

    const c = campaigns.rows[0]
    const r = rate.rows[0]
    const body: NotificationKpis = {
      campaigns30d: c.campaigns_30d,
      sending: c.sending,
      failed30d: c.failed_30d,
      recipients30d: c.recipients_30d,
      deliveryRate30d: r.attempted > 0 ? Math.round((r.sent / r.attempted) * 1000) / 10 : null,
    }
    return NextResponse.json(body)
  } catch (err) {
    return notificationsErrorResponse(err, '[GET /api/admin/notifications/kpis]')
  }
}