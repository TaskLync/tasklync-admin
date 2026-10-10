// app/(admin)/workers/verification/[workerId]/page.tsx
'use client'

import { use, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useVerificationDetail, verificationActions } from '@/hooks/useVerification'
import VerificationHeader from '@/components/verification/VerificationHeader'
import VerificationPersonalInfo from '@/components/verification/VerificationPersonalInfo'
import VerificationCnicCheck from '@/components/verification/VerificationCnicCheck'
import VerificationDocuments from '@/components/verification/VerificationDocuments'
import VerificationSkills from '@/components/verification/VerificationSkills'
import VerificationDecisionPanel from '@/components/verification/VerificationDecisionPanel'
import VerificationHistory from '@/components/verification/VerificationHistory'

function BodySkeleton() {
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="p-4">
            <div className="mb-4 h-3.5 w-36 animate-pulse rounded bg-gray-100" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, j) => (
                <div key={j} className="flex flex-col gap-1.5">
                  <div className="h-2.5 w-16 animate-pulse rounded bg-gray-100" />
                  <div className="h-3.5 w-28 animate-pulse rounded bg-gray-100" />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
      <div className="flex flex-col gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="p-4">
            <div className="mb-4 h-3.5 w-24 animate-pulse rounded bg-gray-100" />
            <div className="h-9 w-full animate-pulse rounded bg-gray-100" />
          </Card>
        ))}
      </div>
    </div>
  )
}

export default function VerificationReviewPage({
  params,
}: {
  params: Promise<{ workerId: string }>
}) {
  const { workerId } = use(params)
  const { detail, isLoading, error, mutate } = useVerificationDetail(workerId)

  // Log "who viewed this" once per page open (the API dedupes within 10 min).
  const viewed = useRef(false)
  useEffect(() => {
    if (detail && !viewed.current) {
      viewed.current = true
      verificationActions.markViewed(workerId).catch(() => {})
    }
  }, [detail, workerId])

  return (
    <div className="px-6 py-5">
      <Link
        href="/workers/verification"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={16} /> Back to verification queue
      </Link>

      <VerificationHeader detail={detail} isLoading={isLoading} error={error} />

      {error && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-white py-10 text-center text-sm text-gray-500">
          Couldn't load this application.{' '}
          <button onClick={() => mutate()} className="text-[#1F6F5F] hover:underline">
            Retry
          </button>
        </div>
      )}

      {isLoading && !detail && !error && <BodySkeleton />}

      {detail && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <VerificationPersonalInfo worker={detail.worker} />
            <VerificationCnicCheck
              workerId={detail.worker.id}
              cnicNumber={detail.worker.cnicNumber}
              duplicates={detail.cnicDuplicates}
              onChanged={() => mutate()}
            />
            <VerificationDocuments documents={detail.documents} avatarUrl={detail.worker.avatarUrl} />
          </div>
          <div className="flex flex-col gap-4">
            <VerificationDecisionPanel detail={detail} onChanged={() => mutate()} />
            <VerificationSkills
              skills={detail.skills}
              documents={detail.documents}
              yearsExperience={detail.worker.yearsExperience}
            />
            <VerificationHistory reviews={detail.reviews} activity={detail.activity} />
          </div>
        </div>
      )}
    </div>
  )
}