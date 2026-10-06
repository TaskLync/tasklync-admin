'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useCategoryDetail, categoryActions } from '@/hooks/useCategories'
import ServicesSection from '@/components/categories/ServicesSection'

function CategoryHeaderSkeleton() {
  return (
    <div className="px-6 py-5">
      <Card className="p-4">
        <div className="h-5 w-40 animate-pulse rounded bg-gray-100" />
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 w-full animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      </Card>
    </div>
  )
}

export default function CategoryDetailPage() {
  const { categoryId } = useParams<{ categoryId: string }>()
  const router = useRouter()
  const { category, isLoading, error, mutate } = useCategoryDetail(categoryId)

  const [name, setName] = useState('')
  const [nameUr, setNameUr] = useState('')
  const [iconUrl, setIconUrl] = useState('')
  const [sortOrder, setSortOrder] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  if (category && !hydrated) {
    setName(category.name)
    setNameUr(category.nameUr ?? '')
    setIconUrl(category.iconUrl ?? '')
    setSortOrder(category.sortOrder)
    setHydrated(true)
  }

  if (error) {
    return (
      <div className="px-6 py-5">
        <p className="text-sm text-gray-500">Couldn't load this category.</p>
      </div>
    )
  }

  if (isLoading || !category) {
    return <CategoryHeaderSkeleton />
  }

  async function handleSave() {
    setSubmitting(true)
    try {
      await categoryActions.update(categoryId, {
        name,
        nameUr: nameUr || null,
        iconUrl: iconUrl || null,
        sortOrder,
      })
      toast.success('Category updated')
      mutate()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="px-6 py-5">
      <button
        onClick={() => router.push('/categories')}
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={16} />
        Back to Categories
      </button>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">
            {category.name}
          </h1>
          <span className="font-mono text-xs text-gray-400">
            {category.id}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Name (Urdu)"
            value={nameUr}
            onChange={(e) => setNameUr(e.target.value)}
          />
          <Input
            label="Icon URL"
            value={iconUrl}
            onChange={(e) => setIconUrl(e.target.value)}
          />
          <Input
            label="Sort order"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
          />
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </Card>

      <div className="mt-4">
        <ServicesSection categoryId={categoryId} />
      </div>
    </div>
  )
}