'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import DataTable, { DataTableColumn } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { usePermission } from '@/hooks/usePermission'
import { categoryActions } from '@/hooks/useCategories'
import { toast } from 'sonner'
import type { CategoryListItem } from '@/types/category'
import CategoryFormDialog from './CategoryFormDialog'

interface Props {
  rows: CategoryListItem[]
  isLoading: boolean
  error: unknown
  onRetry: () => void
  onChanged: () => void
}

export default function CategoryTable({ rows, isLoading, error, onRetry, onChanged }: Props) {
  const router = useRouter()
  const canEdit = usePermission('categories:edit')
  const [editing, setEditing] = useState<CategoryListItem | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const toggling = rows.find((r) => r.id === togglingId) ?? null

  const columns: DataTableColumn<CategoryListItem>[] = [
    {
      key: 'name',
      header: 'Category',
      render: (c) => (
        <div className="flex items-center gap-2">
          {c.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.iconUrl} alt="" className="h-6 w-6 rounded" />
          ) : (
            <div className="h-6 w-6 rounded bg-gray-100" />
          )}
          <div>
            <p className="font-medium text-gray-900">{c.name}</p>
            {c.nameUr && <p className="text-xs text-gray-400">{c.nameUr}</p>}
          </div>
        </div>
      ),
    },
    { key: 'id', header: 'ID', render: (c) => c.id, className: 'font-mono text-xs' },
    { key: 'services', header: 'Sub-services', render: (c) => c.serviceCount },
    { key: 'workers', header: 'Active Workers', render: (c) => c.activeWorkerCount },
    {
      key: 'status',
      header: 'Status',
      render: (c) => (
        <StatusBadge status={c.isActive ? 'active' : 'inactive'} variant={c.isActive ? 'success' : 'neutral'} />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (c) =>
        canEdit ? (
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <Button variant="secondary" size="sm" onClick={() => setEditing(c)}>Edit</Button>
            <Button
              variant={c.isActive ? 'destructive' : 'primary'}
              size="sm"
              onClick={() => setTogglingId(c.id)}
            >
              {c.isActive ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        ) : null,
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(c) => c.id}
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        emptyMessage="No categories match these filters."
        onRowClick={(c) => router.push(`/categories/${c.id}`)}
      />

      {editing && (
        <CategoryFormDialog
          mode="edit"
          category={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            onChanged()
          }}
        />
      )}

      <ConfirmDialog
        open={!!toggling}
        title={toggling?.isActive ? `Deactivate ${toggling?.name}?` : `Activate ${toggling?.name}?`}
        description={
          toggling?.isActive
            ? 'Deactivated categories disappear from user search and worker registration. Existing bookings are unaffected.'
            : 'This category will reappear in user search and worker registration.'
        }
        destructive={!!toggling?.isActive}
        confirmLabel={toggling?.isActive ? 'Deactivate' : 'Activate'}
        onClose={() => setTogglingId(null)}
        onConfirm={async () => {
          if (!toggling) return
          await categoryActions.toggleActive(toggling.id, !toggling.isActive)
          toast.success(toggling.isActive ? 'Category deactivated' : 'Category activated')
          onChanged()
        }}
      />
    </>
  )
}