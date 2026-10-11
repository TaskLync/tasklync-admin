// components/notifications/CampaignDetailView.tsx
'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { KpiCard, KpiCardSkeleton } from '@/components/dashboard/KpiCard'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { useCampaignDetail } from '@/hooks/useNotifications'
import { resolveCampaignMessage } from '@/lib/notification-catalog'
import PhonePreview from './PhonePreview'
import {
  CATEGORY_LABEL,
  CHANNEL_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  audienceLabel,
  formatDateTime,
} from './notification-ui'

const STATUSES = ['SENT', 'FAILED', 'QUEUED', 'SKIPPED'] as const

export default function CampaignDetailView({ campaignId }: { campaignId: string }) {
  const { campaign, isLoading, error, mutate } = useCampaignDetail(campaignId)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-10 w-72 animate-pulse rounded bg-gray-100" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>
        <div className="h-48 animate-pulse rounded-lg bg-gray-100" />
      </div>
    )
  }

  if (error || !campaign) {
    return (
      <Card className="p-6 text-sm text-gray-600">
        <p>{(error as Error | undefined)?.message || "Couldn't load this campaign."}</p>
        <div className="mt-3 flex gap-4">
          <button onClick={() => mutate()} className="text-[#1F6F5F] hover:underline">
            Retry
          </button>
          <Link href="/notifications?tab=history" className="text-[#1F6F5F] hover:underline">
            Back to history
          </Link>
        </div>
      </Card>
    )
  }

  const message = resolveCampaignMessage(campaign.templateKey, campaign.templateData)
  const count = (channel: string, status: string) =>
    campaign.deliveries.find((d) => d.channel === channel && d.status === status)?.count ?? 0
  const channelsUsed = campaign.channels.length ? campaign.channels : (['push'] as const)

  const total = campaign.totalRecipients ?? 0
  const progress = total > 0 ? Math.min(100, Math.round((campaign.sentCount / total) * 100)) : 0
  const pushSent = count('push', 'SENT')
  const failed = campaign.deliveries.filter((d) => d.status === 'FAILED').reduce((s, d) => s + d.count, 0)
  const suppressed = Math.max(0, campaign.feed.total - campaign.feed.withDelivery)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          href="/notifications?tab=history"
          className="mb-2 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={12} /> All broadcasts
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-gray-900">{campaign.title}</h1>
          <Badge tone={STATUS_TONE[campaign.status]}>{STATUS_LABEL[campaign.status]}</Badge>
          <Badge tone={campaign.category === 'platform' ? 'info' : 'warning'}>
            {CATEGORY_LABEL[campaign.category]}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {audienceLabel(campaign.segmentType, campaign.segmentFilter)} · sent by{' '}
          {campaign.createdByName ?? 'an admin'} · {formatDateTime(campaign.createdAt)}
          {campaign.completedAt && <> · finished {formatDateTime(campaign.completedAt)}</>}
        </p>
      </div>

      {campaign.status === 'SENDING' && (
        <Card className="p-4">
          <div className="mb-2 flex justify-between text-sm text-gray-600">
            <span>Sending…</span>
            <span>
              {campaign.sentCount.toLocaleString('en-PK')} / {total ? total.toLocaleString('en-PK') : 'counting…'}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-gray-100">
            <div className="h-full bg-[#1F6F5F] transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-gray-400">This page refreshes by itself every few seconds.</p>
        </Card>
      )}

      {campaign.status === 'FAILED' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          This campaign failed before finishing (segment lookup or dispatch error, or the template file is missing in
          notification-service). Nothing is retried automatically. Check the service logs, fix the cause, then send a new
          broadcast.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Recipients" value={total ? total.toLocaleString('en-PK') : '—'} color="#1F6F5F" />
        <KpiCard label="In-app notifications" value={campaign.feed.total.toLocaleString('en-PK')} color="#2563EB" />
        <KpiCard label="Pushes sent" value={pushSent.toLocaleString('en-PK')} color="#D97706" />
        <KpiCard label="Failed" value={failed.toLocaleString('en-PK')} color="#DC2626" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Delivery by channel</h2>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-gray-500">
                <tr>
                  <th className="py-2 text-left font-medium">Channel</th>
                  {STATUSES.map((s) => (
                    <th key={s} className="py-2 text-right font-medium">
                      {s.charAt(0) + s.slice(1).toLowerCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {channelsUsed.map((ch) => (
                  <tr key={ch} className="border-t border-gray-100">
                    <td className="py-2 font-medium text-gray-800">{CHANNEL_LABEL[ch] ?? ch}</td>
                    {STATUSES.map((s) => (
                      <td key={s} className="py-2 text-right text-gray-700">
                        {count(ch, s).toLocaleString('en-PK')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
              <p>
                <strong>{suppressed.toLocaleString('en-PK')}</strong> people got the in-app notification but no push or SMS
                was attempted. That is normal: they opted out of this category, have no device token or phone, or it was
                quiet hours.
              </p>
              {campaign.feed.total > 0 && (
                <p className="mt-1">
                  {campaign.feed.read.toLocaleString('en-PK')} of {campaign.feed.total.toLocaleString('en-PK')} have read it
                  in the app.
                </p>
              )}
            </div>
          </Card>

          {campaign.errors.length > 0 && (
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Top failure reasons</h2>
              <ul className="flex flex-col gap-2 text-sm">
                {campaign.errors.map((e, i) => (
                  <li key={i} className="flex items-start justify-between gap-3">
                    <span className="text-gray-700">
                      <span className="mr-2 font-medium">{CHANNEL_LABEL[e.channel as 'push' | 'sms'] ?? e.channel}</span>
                      <span className="break-words text-gray-500">{e.error ?? 'No error message'}</span>
                    </span>
                    <span className="shrink-0 font-medium text-red-600">{e.count.toLocaleString('en-PK')}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-gray-400">
                A &quot;token not registered&quot; error just means that person uninstalled the app. It is not an outage.
              </p>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Message</h2>
            {message ? (
              <>
                <p className="mb-2 text-xs text-gray-500">{message.label}</p>
                <PhonePreview title={message.title} body={message.body} sms={campaign.channels.includes('sms')} />
              </>
            ) : (
              <p className="text-sm text-gray-500">
                Template <code>{campaign.templateKey}</code> is not in the catalog (probably sent by another tool).
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}