'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import DataTable, { DataTableColumn } from '@/components/shared/DataTable'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { usePendingPromotionCount, usePromotionFilters, usePromotionList } from '@/hooks/usePromotions'
import { PROMOTION_STATE_LABEL, PROMOTION_STATUS_FILTERS, type PromotionState } from '@/lib/promotion-constants'
import { formatDateTime, formatPkr, shortId } from '@/components/bookings/booking-ui'
import type { PromotionItem } from '@/types/promotion'
import PromotionGuardrails from './PromotionGuardrails'

export const PROMOTION_TONE: Record<PromotionState, BadgeTone> = {
  pending: 'warning', rejected: 'danger', scheduled: 'info', active: 'success', paused: 'warning',
  paused_admin: 'danger', exhausted: 'neutral', expired: 'neutral', ended: 'neutral',
}

export const discountText = (p: Pick<PromotionItem, 'discountType' | 'discountValue' | 'maxDiscountAmount'>) =>
  p.discountType === 'PERCENT'
    ? `${p.discountValue}%${p.maxDiscountAmount ? ` (max ${formatPkr(p.maxDiscountAmount, 'PKR')})` : ''}`
    : formatPkr(p.discountValue, 'PKR')

export default function PromotionsSection() {
  const router = useRouter()
  const [tab, setTab] = useState<'offers' | 'guardrails'>('offers')
  const { filters, update, reset } = usePromotionFilters()
  const { promotions, isLoading, error, mutate } = usePromotionList(filters)
  const pending = usePendingPromotionCount()

  const columns: DataTableColumn<PromotionItem>[] = [
    {
      key: 'title', header: 'Offer',
      render: (p) => (
        <div>
          <div className="text-sm font-medium text-gray-900">{p.title}</div>
          {p.code && <div className="font-mono text-xs text-gray-500">{p.code}</div>}
        </div>
      ),
    },
    {
      key: 'worker', header: 'Worker',
      render: (p) => (
        <Link href={`/workers/${p.workerId}`} className="text-[#1F6F5F] hover:underline" onClick={(e) => e.stopPropagation()}>
          {p.workerName ?? shortId(p.workerId)}
        </Link>
      ),
    },
    { key: 'discount', header: 'Discount', render: (p) => discountText(p) },
    { key: 'used', header: 'Used', render: (p) => `${p.redemptionCount}${p.maxRedemptions ? ` / ${p.maxRedemptions}` : ''}` },
    { key: 'window', header: 'Valid', render: (p) => `${formatDateTime(p.startsAt)} to ${formatDateTime(p.endsAt)}` },
    { key: 'mode', header: 'Approval', render: (p) => (p.approvalMode === 'AUTO' ? 'Automatic' : 'Admin') },
    { key: 'state', header: 'Status', render: (p) => <Badge tone={PROMOTION_TONE[p.state]}>{PROMOTION_STATE_LABEL[p.state]}</Badge> },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b border-gray-200">
        {(['offers', 'guardrails'] as const).map((t) => (
          <button
            key={t} onClick={() => setTab(t)}
            className={`-mb-px h-9 border-b-2 px-3 text-sm ${tab === t ? 'border-[#1F6F5F] font-medium text-[#1F6F5F]' : 'border-transparent text-gray-500'}`}
          >
            {t === 'offers' ? 'Offers' : 'Guardrails'}
          </button>
        ))}
      </div>

      {tab === 'guardrails' ? (
        <PromotionGuardrails />
      ) : (
        <>
          {pending > 0 && (
            <button
              onClick={() => update({ status: 'PENDING_APPROVAL' })}
              className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-left text-sm text-amber-800 hover:bg-amber-100"
            >
              {pending} offer{pending === 1 ? '' : 's'} waiting for approval. Click to show them.
            </button>
          )}

          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3">
            <div className="min-w-[220px] flex-1">
              <Input label="Search" placeholder="Offer title or worker" value={filters.search} onChange={(e) => update({ search: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Status</label>
              <select className="h-9 rounded-md border border-gray-300 px-3 text-sm" value={filters.status} onChange={(e) => update({ status: e.target.value })}>
                {PROMOTION_STATUS_FILTERS.map((s) => (
                  <option key={s} value={s}>{s === 'all' ? 'All' : s.replace('_', ' ').toLowerCase()}</option>
                ))}
              </select>
            </div>
            <button onClick={reset} className="h-9 px-3 text-sm text-gray-500 hover:text-gray-700">Clear filters</button>
          </div>

          <DataTable
            columns={columns} rows={promotions?.data ?? []} rowKey={(p) => p.id} isLoading={isLoading} error={error}
            onRetry={() => mutate()} emptyMessage="No offers match these filters." onRowClick={(p) => router.push(`/promotions/${p.id}`)}
          />

          {promotions && promotions.total > 0 && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>{promotions.total.toLocaleString()} offers</span>
              <div className="flex gap-2">
                <button className="h-9 rounded-md border border-gray-300 px-3 disabled:opacity-40" disabled={filters.page <= 1} onClick={() => update({ page: filters.page - 1 })}>Previous</button>
                <button className="h-9 rounded-md border border-gray-300 px-3 disabled:opacity-40" disabled={filters.page >= promotions.totalPages} onClick={() => update({ page: filters.page + 1 })}>Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}