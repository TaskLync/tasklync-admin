'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import CouponDetailView from '@/components/coupons/CouponDetailView'

export default function CouponDetailPage({ params }: { params: Promise<{ couponId: string }> }) {
  const { couponId } = use(params)
  return (
    <div className="px-6 py-5">
      <Link href="/coupons" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} /> Back to Coupons
      </Link>
      <CouponDetailView couponId={couponId} />
    </div>
  )
}