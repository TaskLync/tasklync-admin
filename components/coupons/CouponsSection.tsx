'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import DataTable, { DataTableColumn } from '@/components/shared/DataTable'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { usePermission } from '@/hooks/usePermission'
import { useCouponFilters, useCouponList } from '@/hooks/useCoupons'
import { COUPON_STATUS_FILTERS, STATE_LABEL, type CouponState } from '@/lib/coupon-constants'
import { formatDateTime, formatPkr } from '@/components/bookings/booking-ui'
import type { CouponItem } from '@/types/coupon'
import CouponFormDialog from './CouponFormDialog'

export const STATE_TONE: Record<CouponState, BadgeTone> = {
  pending: 'warning', rejected: 'danger', scheduled: 'info', active: 'success',
  paused: 'warning', exhausted: 'neutral', expired: 'neutral', ended: 'neutral',
}

export const offerText = (c: Pick<CouponItem, 'discountType' | 'discountValue' | 'maxDiscountAmount'>) =>
  c.discountType === 'PERCENT'
    ? `${c.discountValue}%${c.maxDiscountAmount ? ` (max ${formatPkr(c.maxDiscountAmount, 'PKR')})` : ''}`
    : formatPkr(c.discountValue, 'PKR')

export default function CouponsSection() {
  const router = useRouter()
  const { filters, update, reset } = useCouponFilters()
  const { coupons, isLoading, error, mutate } = useCouponList(filters)
  const canCreate = usePermission('coupons:create')
  const [creating, setCreating] = useState(false)

  const columns: DataTableColumn<CouponItem>[] = [
    { key: 'code', header: 'Code', render: (c) => <span className="font-mono text-xs font-semibold">{c.code}</span> },
    { key: 'title', header: 'Title', render: (c) => c.title },
    { key: 'offer', header: 'Offer', render: (c) => offerText(c) },
    { key: 'used', header: 'Used', render: (c) => `${c.redemptionCount}${c.maxRedemptions ? ` / ${c.maxRedemptions}` : ''}` },
    { key: 'budget', header: 'Discounted', render: (c) => formatPkr(c.budgetSpentPkr, 'PKR') },
    { key: 'window', header: 'Valid', render: (c) => `${formatDateTime(c.startsAt)} to ${formatDateTime(c.endsAt)}` },
    { key: 'state', header: 'Status', render: (c) => <Badge tone={STATE_TONE[c.state]}>{STATE_LABEL[c.state]}</Badge> },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3">
        <div className="min-w-[220px] flex-1">
          <Input label="Search" placeholder="Code or title" value={filters.search} onChange={(e) => update({ search: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Status</label>
          <select className="h-9 rounded-md border border-gray-300 px-3 text-sm" value={filters.status} onChange={(e) => update({ status: e.target.value })}>
            {COUPON_STATUS_FILTERS.map((s) => <option key={s} value={s}>{s === 'all' ? 'All' : s.replace('_', ' ').toLowerCase()}</option>)}
          </select>
        </div>
        <button onClick={reset} className="h-9 px-3 text-sm text-gray-500 hover:text-gray-700">Clear filters</button>
        {canCreate && <Button onClick={() => setCreating(true)}>New coupon</Button>}
      </div>

      <DataTable
        columns={columns} rows={coupons?.data ?? []} rowKey={(c) => c.id} isLoading={isLoading} error={error}
        onRetry={() => mutate()} emptyMessage="No coupons match these filters." onRowClick={(c) => router.push(`/coupons/${c.id}`)}
      />

      {coupons && coupons.total > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{coupons.total.toLocaleString()} coupons</span>
          <div className="flex gap-2">
            <button className="h-9 rounded-md border border-gray-300 px-3 disabled:opacity-40" disabled={filters.page <= 1} onClick={() => update({ page: filters.page - 1 })}>Previous</button>
            <button className="h-9 rounded-md border border-gray-300 px-3 disabled:opacity-40" disabled={filters.page >= coupons.totalPages} onClick={() => update({ page: filters.page + 1 })}>Next</button>
          </div>
        </div>
      )}

      {creating && <CouponFormDialog onClose={() => setCreating(false)} onSaved={() => { setCreating(false); mutate() }} />}
    </div>
  )
}