// app/(admin)/disputes/[disputeId]/page.tsx
'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useSWRConfig } from 'swr'
import { useDisputeDetail } from '@/hooks/useDisputes'
import DisputeHeader from '@/components/disputes/DisputeHeader'
import DisputeSummary from '@/components/disputes/DisputeSummary'
import DisputeResponses from '@/components/disputes/DisputeResponses'
import DisputeEvidence from '@/components/disputes/DisputeEvidence'
import DisputeResolutionPanel from '@/components/disputes/DisputeResolutionPanel'
import DisputeRefundStatus from '@/components/disputes/DisputeRefundStatus'
import DisputeParties from '@/components/disputes/DisputeParties'
import DisputeNotes from '@/components/disputes/DisputeNotes'
import DisputeActivity from '@/components/disputes/DisputeActivity'

export default function DisputeDetailPage({
  params,
}: {
  params: Promise<{ disputeId: string }>
}) {
  const { disputeId } = use(params)
  const { dispute, isLoading, error, mutate } = useDisputeDetail(disputeId)
  const { mutate: globalMutate } = useSWRConfig()

  // After any action: reload this dispute, the queue + counts, and the booking behind it.
  function refreshAll() {
    mutate()
    globalMutate(
      (key) =>
        typeof key === 'string' &&
        (key.startsWith('/api/admin/disputes') ||
          (dispute ? key.startsWith(`/api/admin/bookings/${dispute.bookingId}`) : false))
    )
  }

  return (
    <div className="px-6 py-5">
      <Link
        href="/disputes"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={16} /> Back to Disputes
      </Link>

      <DisputeHeader dispute={dispute} isLoading={isLoading} error={error} />

      {error && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-white py-10 text-center text-sm text-gray-500">
          {error.message === 'Dispute not found' ? (
            "This dispute doesn't exist."
          ) : (
            <>
              Couldn't load this dispute.{' '}
              <button onClick={() => mutate()} className="text-[#1F6F5F] hover:underline">
                Retry
              </button>
            </>
          )}
        </div>
      )}

      {dispute && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <DisputeSummary dispute={dispute} />
            <DisputeResponses dispute={dispute} />
            <DisputeEvidence bookingId={dispute.bookingId} />
          </div>
          <div className="flex flex-col gap-4">
            <DisputeResolutionPanel dispute={dispute} onChanged={refreshAll} />
            <DisputeRefundStatus dispute={dispute} />
            <DisputeParties dispute={dispute} />
            <DisputeNotes disputeId={dispute.id} />
            <DisputeActivity activity={dispute.activity} />
          </div>
        </div>
      )}
    </div>
  )
}