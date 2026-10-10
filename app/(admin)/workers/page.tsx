// app/(admin)/workers/page.tsx
import WorkersTableSection from '@/components/workers/WorkersTableSection'
import { WorkerKpiGrid } from '@/components/workers/WorkerKpiGrid'

export const metadata = { title: 'Workers | Tasklync Admin' }

export default function WorkersPage() {
  return (
    <div className="px-6 py-5">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-gray-900">Workers</h1>
        <p className="text-sm text-gray-500">Search, filter, and manage every worker on the platform.</p>
      </div>
      <div className="mb-4">
        <WorkerKpiGrid />
      </div>
      <WorkersTableSection />
    </div>
  )
}