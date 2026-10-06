'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import DataTable, { DataTableColumn } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { usePermission } from '@/hooks/usePermission'
import { useCategoryServices, serviceActions } from '@/hooks/useCategories'
import type { ServiceItem } from '@/types/category'
import ServiceFormDialog from './ServiceFormDialog'

function formatPkr(n: number | null) {
  return n === null ? '—' : `PKR ${n.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`
}

export default function ServicesSection({ categoryId }: { categoryId: string }) {
  const { services, isLoading, error, mutate } = useCategoryServices(categoryId)
  const canEdit = usePermission('services:edit')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<ServiceItem | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const toggling = services.find((s) => s.id === togglingId) ?? null

  const columns: DataTableColumn<ServiceItem>[] = [
    {
      key: 'name',
      header: 'Service',
      render: (s) => (
        <div>
          <p className="font-medium text-gray-900">{s.name}</p>
          {s.nameUr && <p className="text-xs text-gray-400">{s.nameUr}</p>}
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Base Price',
      render: (s) => (s.priceType === 'quote' ? 'By quote' : `${formatPkr(s.basePrice)} / ${s.priceType}`),
    },
    { key: 'duration', header: 'Min Duration', render: (s) => `${s.minDurationMins} min` },
    {
      key: 'status',
      header: 'Status',
      render: (s) => (
        <StatusBadge status={s.isActive ? 'active' : 'inactive'} variant={s.isActive ? 'success' : 'neutral'} />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (s) =>
        canEdit ? (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditing(s)}>Edit</Button>
            <Button variant={s.isActive ? 'destructive' : 'primary'} size="sm" onClick={() => setTogglingId(s.id)}>
              {s.isActive ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        ) : null,
    },
  ]

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Services</h2>
        {canEdit && <Button size="sm" onClick={() => setCreating(true)}>Add Service</Button>}
      </div>

      <DataTable
        columns={columns}
        rows={services}
        rowKey={(s) => s.id}
        isLoading={isLoading}
        error={error}
        onRetry={() => mutate()}
        emptyMessage="No services in this category yet."
      />

      {creating && (
        <ServiceFormDialog
          mode="create"
          categoryId={categoryId}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); mutate() }}
        />
      )}
      {editing && (
        <ServiceFormDialog
          mode="edit"
          categoryId={categoryId}
          service={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); mutate() }}
        />
      )}

      <ConfirmDialog
        open={!!toggling}
        title={toggling?.isActive ? `Deactivate ${toggling?.name}?` : `Activate ${toggling?.name}?`}
        description={
          toggling?.isActive
            ? 'Workers can no longer add this as a new offering. Existing worker offerings referencing it are unaffected.'
            : 'This service becomes available again for workers to offer.'
        }
        destructive={!!toggling?.isActive}
        confirmLabel={toggling?.isActive ? 'Deactivate' : 'Activate'}
        onClose={() => setTogglingId(null)}
        onConfirm={async () => {
          if (!toggling) return
          await serviceActions.toggleActive(categoryId, toggling.id, !toggling.isActive)
          toast.success(toggling.isActive ? 'Service deactivated' : 'Service activated')
          mutate()
        }}
      />
    </Card>
  )
}