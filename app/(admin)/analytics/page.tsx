// app/(admin)/analytics/page.tsx
import AnalyticsSection from '@/components/analytics/AnalyticsSection'

export const metadata = { title: 'Analytics | Tasklync Admin' }

export default function AnalyticsPage() {
  return (
    <div className="px-6 py-5">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-gray-900">Analytics &amp; Insights</h1>
        <p className="text-sm text-gray-500">
          How the marketplace is growing, where people drop off, and which cities and categories perform.
        </p>
      </div>
      <AnalyticsSection />
    </div>
  )
}