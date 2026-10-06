'use client'

import { useState } from 'react'
import { useMemo } from 'react'
import { useCategoriesList, useCategoryFilters } from '@/hooks/useCategories'
import { usePermission } from '@/hooks/usePermission'
import { Button } from '@/components/ui/Button'
import CategoryFilterBar from './CategoryFilterBar'
import CategoryTable from './CategoryTable'
import CategoryFormDialog from './CategoryFormDialog'

export default function CategoriesTableSection() {
  const { filters, update, reset } = useCategoryFilters()
  const { categories, isLoading, error, mutate } = useCategoriesList(filters)
  const canCreate = usePermission('categories:create')
  const [creating, setCreating] = useState(false)

  const totalPages = categories?.totalPages ?? 1

  const pageSummary = useMemo(() => {
    if (!categories) return ''
    const start = (categories.page - 1) * categories.pageSize + 1
    const end = Math.min(categories.page * categories.pageSize, categories.total)
    return `${start}–${end} of ${categories.total}`
  }, [categories])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Categories {categories ? `(${categories.total.toLocaleString()})` : ''}
        </h2>
        {canCreate && (
          <Button onClick={() => setCreating(true)}>New Category</Button>
        )}
      </div>

      <CategoryFilterBar filters={filters} onChange={update} onReset={reset} />

      <CategoryTable
        rows={categories?.data ?? []}
        isLoading={isLoading}
        error={error}
        onRetry={() => mutate()}
        onChanged={() => mutate()}
      />

      {categories && categories.total > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{pageSummary}</span>
          <div className="flex gap-2">
            <button
              className="h-9 rounded-md border border-gray-300 px-3 disabled:opacity-40"
              disabled={filters.page <= 1}
              onClick={() => update({ page: filters.page - 1 })}
            >
              Previous
            </button>
            <button
              className="h-9 rounded-md border border-gray-300 px-3 disabled:opacity-40"
              disabled={filters.page >= totalPages}
              onClick={() => update({ page: filters.page + 1 })}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {creating && (
        <CategoryFormDialog
          mode="create"
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            mutate()
          }}
        />
      )}
    </div>
  )
}