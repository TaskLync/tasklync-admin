// components/notifications/HistoryTab.tsx
'use client'

import { useRouter } from 'next/navigation'
import DataTable, { DataTableColumn } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { useFilterState } from '@/hooks/usePayments'
import { DEFAULT_CAMPAIGN_FILTERS, useCampaignList } from '@/hooks/useNotifications'
import { parseTemplateKey, LANGUAGE_LABEL } from '@/lib/notification-catalog'
import { BROADCAST_STATUSES, CUSTOM_TEMPLATE_KEY, SEGMENT_TYPES } from '@/lib/notification-constants'
import type { CampaignFilters, CampaignListItem } from '@/types/notification'
import {
  CATEGORY_LABEL,
  CHANNEL_LABEL,
  Field,
  Pager,
  SELECT_CLASS,
  STATUS_LABEL,
  STATUS_TONE,
  audienceLabel,
  formatDateTime,
} from './notification-ui'

const SEGMENT_LABEL: Record<(typeof SEGMENT_TYPES)[number], string> = {
  all_users: 'All users',
  all_workers: 'All workers',
  category_city: 'Workers by service & city',
  custom_ids: 'Specific people',
}

function messageName(templateKey: string): string {
  if (templateKey === CUSTOM_TEMPLATE_KEY) return 'Custom message'
  const parsed = parseTemplateKey(templateKey)
  return parsed ? `${parsed.template.name} · ${LANGUAGE_LABEL[parsed.language]}` : templateKey
}

export default function HistoryTab() {
  const router = useRouter()
  const { filters, update, reset } = useFilterState<CampaignFilters>(DEFAULT_CAMPAIGN_FILTERS)
  const { campaigns, isLoading, error, mutate } = useCampaignList(filters)

  const columns: DataTableColumn<CampaignListItem>[] = [
    {
      key: 'campaign',
      header: 'Campaign',
      render: (c) => (
        <div className="leading-tight">
          <span className="font-medium text-gray-900">{c.title}</span>
          <span className="block text-[11px] text-gray-400">{messageName(c.templateKey)}</span>
        </div>
      ),
    },
    { key: 'audience', header: 'Audience', render: (c) => audienceLabel(c.segmentType, c.segmentFilter) },
    {
      key: 'type',
      header: 'Type',
      render: (c) => <Badge tone={c.category === 'platform' ? 'info' : 'warning'}>{CATEGORY_LABEL[c.category]}</Badge>,
    },
    { key: 'channels', header: 'Channels', render: (c) => c.channels.map((ch) => CHANNEL_LABEL[ch] ?? ch).join(' + ') },
    {
      key: 'status',
      header: 'Status',
      render: (c) => <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>,
    },
    {
      key: 'recipients',
      header: 'Recipients',
      render: (c) =>
        c.status === 'SENDING'
          ? `${c.sentCount.toLocaleString('en-PK')} / ${c.totalRecipients?.toLocaleString('en-PK') ?? '…'}`
          : (c.totalRecipients?.toLocaleString('en-PK') ?? '—'),
    },
    { key: 'by', header: 'Sent by', render: (c) => c.createdByName ?? '—' },
    { key: 'when', header: 'Created', render: (c) => formatDateTime(c.createdAt) },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3">
        <div className="min-w-[240px] flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-700">Search</label>
          <Input
            placeholder="Campaign name or template"
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
          />
        </div>
        <Field label="Status">
          <select
            className={SELECT_CLASS}
            value={filters.status}
            onChange={(e) => update({ status: e.target.value as CampaignFilters['status'] })}
          >
            <option value="all">All</option>
            {BROADCAST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Audience">
          <select
            className={SELECT_CLASS}
            value={filters.segmentType}
            onChange={(e) => update({ segmentType: e.target.value as CampaignFilters['segmentType'] })}
          >
            <option value="all">All</option>
            {SEGMENT_TYPES.map((s) => (
              <option key={s} value={s}>
                {SEGMENT_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <button onClick={reset} className="h-9 px-3 text-sm text-gray-500 hover:text-gray-700">
          Clear filters
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={campaigns?.data ?? []}
        rowKey={(c) => c.id}
        isLoading={isLoading}
        error={error}
        onRetry={() => mutate()}
        emptyMessage="No broadcasts yet. Compose your first one."
        onRowClick={(c) => router.push(`/notifications/${c.id}`)}
        rowClassName={(c) => (c.status === 'FAILED' ? 'bg-red-50! even:bg-red-50! hover:bg-red-100!' : '')}
      />

      {campaigns && (
        <Pager
          page={filters.page}
          pageSize={filters.pageSize}
          total={campaigns.total}
          onPage={(page) => update({ page })}
        />
      )}
    </div>
  )
}