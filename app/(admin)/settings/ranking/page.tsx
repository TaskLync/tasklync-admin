import { Suspense } from 'react'
import RankingSection from '@/components/ranking/RankingSection'

export const metadata = { title: 'Ranking | Tasklync Admin' }

export default function RankingPage() {
  return (
    <div className="px-6 py-5">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-gray-900">Search ranking</h1>
        <p className="text-sm text-gray-500">
          Versioned weights, shadow runs and scoped overrides. Changes reach search within about a minute. Rollback = activate the previous version.
        </p>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-gray-100" />}>
        <RankingSection />
      </Suspense>
    </div>
  )
}