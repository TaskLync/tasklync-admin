// app/(admin)/notifications/[campaignId]/page.tsx
import CampaignDetailView from '@/components/notifications/CampaignDetailView'

export const metadata = { title: 'Broadcast | Tasklync Admin' }

export default async function CampaignPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params
  return (
    <div className="px-6 py-5">
      <CampaignDetailView campaignId={campaignId} />
    </div>
  )
}