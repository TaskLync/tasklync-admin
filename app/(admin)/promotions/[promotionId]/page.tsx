'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import PromotionDetailView from '@/components/promotions/PromotionDetailView'

export default function PromotionDetailPage({ params }: { params: Promise<{ promotionId: string }> }) {
  const { promotionId } = use(params)
  return (
    <div className="px-6 py-5">
      <Link href="/promotions" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} /> Back to Promotions
      </Link>
      <PromotionDetailView promotionId={promotionId} />
    </div>
  )
}