import Link from 'next/link'
import { CategoryKpiGrid } from '@/components/categories/CategoryKpiGrid'
import CategoriesTableSection from '@/components/categories/CategoriesTableSection'

export default function CategoriesPage() {
  return (
    <div className="flex flex-col gap-5 px-6 py-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            Categories & Pricing
          </h1>
          <p className="text-sm text-gray-500">
            Manage service categories, services, and platform pricing configuration.
          </p>
        </div>

        <Link
          href="/categories/pricing"
          className="text-sm font-medium text-[--accent] hover:underline"
        >
          Global Pricing Config →
        </Link>
      </div>

      <CategoryKpiGrid />

      <CategoriesTableSection />
    </div>
  )
}