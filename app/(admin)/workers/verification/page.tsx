// app/(admin)/workers/verification/page.tsx
import VerificationQueueSection from '@/components/verification/VerificationQueueSection'
import { VerificationKpiGrid } from '@/components/verification/VerificationKpiGrid'

export const metadata = { title: 'Worker Verification | Tasklync Admin' }

export default function WorkerVerificationPage() {
  return (
    <div className="px-6 py-5">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-gray-900">Worker Verification</h1>
        <p className="text-sm text-gray-500">
          Review identity documents and decide who can take bookings on Tasklync.
        </p>
      </div>
      <div className="mb-4">
        <VerificationKpiGrid />
      </div>
      <VerificationQueueSection />
    </div>
  )
}