// app/(admin)/page.tsx
import { KpiGrid } from '@/components/dashboard/KpiGrid'
import { AttentionPanel } from '@/components/dashboard/AttentionPanel'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { RevenueChart } from '@/components/dashboard/RevenueChart'
import { BookingFunnel } from '@/components/dashboard/BookingFunnel'

export const metadata = {
  title: 'Dashboard | TaskLync Admin',
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-4 px-6 py-5">
      <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>

      {/* 1.1 KPI Cards */}
      <KpiGrid />

      {/* 1.2 Needs Attention + 1.3 Live Activity, side by side on desktop */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AttentionPanel />
        <ActivityFeed />
      </div>

      {/* 1.4 Revenue Chart */}
      <RevenueChart />

      {/* 1.5 Booking Status Funnel */}
      <BookingFunnel />
    </div>
  )
}