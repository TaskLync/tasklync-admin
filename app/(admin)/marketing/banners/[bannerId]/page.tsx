'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import BannerEditor from '@/components/banners/BannerEditor'
import { useBannerDetail } from '@/hooks/useBanners'

export default function BannerDetailPage({ params }: { params: Promise<{ bannerId: string }> }) {
  const { bannerId } = use(params)
  const { banner, error, isLoading, mutate } = useBannerDetail(bannerId)
  return (
    <div className="px-6 py-5">
      <Link href="/marketing/banners" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} /> Back to banners
      </Link>
      {isLoading ? (
        <div className="h-96 animate-pulse rounded-lg bg-gray-100" />
      ) : error || !banner ? (
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 text-sm text-red-600">
          <span>{(error as Error | undefined)?.message || 'Banner not found'}</span>
          <Button variant="secondary" size="sm" onClick={() => mutate()}>Retry</Button>
        </div>
      ) : (
        <BannerEditor key={banner.id} banner={banner} onChanged={() => mutate()} />
      )}
    </div>
  )
}
