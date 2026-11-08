'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import RankingExplainView from '@/components/ranking/RankingExplainView'

export default function RankingExplainPage({ params }: { params: Promise<{ workerId: string }> }) {
  const { workerId } = use(params)
  return (
    <div className="px-6 py-5">
      <Link href={`/workers/${workerId}`} className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} /> Back to worker
      </Link>
      <RankingExplainView workerId={workerId} />
    </div>
  )
}