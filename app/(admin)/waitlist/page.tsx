// app/(admin)/waitlist/page.tsx
import { WaitlistKpiGrid } from '@/components/waitlist/WaitlistKpiGrid'
import { WaitlistGrowthChart } from '@/components/waitlist/WaitlistGrowthChart'
import { UtmSourceChart } from '@/components/waitlist/UtmSourceChart'
import { DeviceBreakdownChart } from '@/components/waitlist/DeviceBreakdownChart'
import { WaitlistTableSection } from '@/components/waitlist/WaitlistTableSection'

export default function WaitlistPage() {
  return (
    <div className="flex flex-col gap-5 px-6 py-5">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Waitlist</h1>
        <p className="text-sm text-gray-500">
          Pre launch signups, growth, traffic sources, and device breakdown of TaskLync website.
        </p>
      </div>

      <WaitlistKpiGrid />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <WaitlistGrowthChart />
        </div>
        <UtmSourceChart />
      </div>

      <DeviceBreakdownChart />

      <WaitlistTableSection />
    </div>
  )
}