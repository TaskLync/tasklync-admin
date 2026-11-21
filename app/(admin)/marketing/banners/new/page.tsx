import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import BannerEditor from '@/components/banners/BannerEditor'

export const metadata = { title: 'New banner | Tasklync Admin' }

export default function NewBannerPage() {
  return (
    <div className="px-6 py-5">
      <Link href="/marketing/banners" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} /> Back to banners
      </Link>
      <BannerEditor />
    </div>
  )
}
