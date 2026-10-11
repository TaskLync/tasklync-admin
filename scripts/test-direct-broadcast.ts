// scripts/test-direct-broadcast.ts
import 'dotenv/config'
import { launchDirectBroadcast } from '../lib/direct-broadcast-engine'
import { db } from '../lib/db'

async function runTest() {
  console.log('🚀 Running launchDirectBroadcast test...')
  const result = await launchDirectBroadcast({
    title: '[VERIFICATION] Direct Admin Push Test',
    template_key: 'admin_custom_message',
    template_data: {
      title: 'TaskLync Operations Center',
      body: 'Push notification engine is now running directly from TaskLync Admin! 🎯',
      deepLink: 'tasklync://home',
    },
    channels: ['push'],
    category: 'platform',
    segment_type: 'custom_ids',
    segment_filter: { user_ids: ['3ad31163-dcda-481b-adeb-0e3305d50e8a'] },
    created_by: '6ae34114-b5ad-4e7f-9a96-12adb2303176',
  })

  console.log('✅ Result:', JSON.stringify(result, null, 2))

  const deliveries = await db.query(
    `SELECT d.id, d.status, d.channel, d.provider, d.provider_message_id, d.delivered_at, n.title, n.recipient_id
     FROM notification_deliveries d
     JOIN notifications n ON n.id = d.notification_id
     WHERE n.campaign_id = $1`,
    [result.campaign_id]
  )

  console.log('📊 Notification Deliveries in Database:')
  console.table(deliveries.rows)
  process.exit(0)
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err)
  process.exit(1)
})
