// app/(admin)/workers/[workerId]/page.tsx
'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useWorkerDetail } from '@/hooks/useWorkers'
import WorkerProfileHeader from '@/components/workers/WorkerProfileHeader'
import WorkerPerformance from '@/components/workers/WorkerPerformance'
import WorkerEarnings from '@/components/workers/WorkerEarnings'
import WorkerJobHistory from '@/components/workers/WorkerJobHistory'
import WorkerReviewHistory from '@/components/workers/WorkerReviewHistory'
import WorkerAdminActions from '@/components/workers/WorkerAdminActions'
import WorkerAvailability from '@/components/workers/WorkerAvailability'
import WorkerSkillsOfferings from '@/components/workers/WorkerSkillsOfferings'
import WorkerDocuments from '@/components/workers/WorkerDocuments'

export default function WorkerDetailPage({ params }: { params: Promise<{ workerId: string }> }) {
  const { workerId } = use(params)
  const { worker, isLoading, error, mutate } = useWorkerDetail(workerId)

  return (
    <div className="px-6 py-5">
      <Link
        href="/workers"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={16} /> Back to Workers
      </Link>

      <WorkerProfileHeader worker={worker} isLoading={isLoading} error={error} />

      {error && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-white py-10 text-center text-sm text-gray-500">
          Couldn't load this worker.{' '}
          <button onClick={() => mutate()} className="text-[#1F6F5F] hover:underline">
            Retry
          </button>
        </div>
      )}

      {worker && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <WorkerPerformance workerId={worker.id} />
            <WorkerEarnings workerId={worker.id} />
            <WorkerJobHistory workerId={worker.id} />
            <WorkerReviewHistory workerId={worker.id} />
          </div>
          <div className="flex flex-col gap-4">
            <WorkerAdminActions worker={worker} onChanged={() => mutate()} />
            <WorkerAvailability workerId={worker.id} />
            <WorkerSkillsOfferings workerId={worker.id} />
            <WorkerDocuments workerId={worker.id} />
          </div>
        </div>
      )}
    </div>
  )
}