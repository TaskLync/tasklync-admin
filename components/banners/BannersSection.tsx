'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, GripVertical, ImageIcon, Megaphone } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { usePermission } from '@/hooks/usePermission'
import { bannerActions, useBannerList } from '@/hooks/useBanners'
import { BANNER_STATES, CTA_ACTION_META, STATE_LABEL, formatPkt, type BannerState } from '@/lib/banner-constants'
import type { BannerItem } from '@/types/banner'
import CarouselSettingsCard from './CarouselSettingsCard'

export const STATE_TONE: Record<BannerState, BadgeTone> = {
  draft: 'neutral', scheduled: 'info', live: 'success', paused: 'warning', expired: 'neutral',
}

const ctr = (b: BannerItem) => (b.impressions ? `${((b.clicks / b.impressions) * 100).toFixed(1)}%` : '—')

export default function BannersSection() {
  const router = useRouter()
  const [state, setState] = useState<BannerState | 'all'>('all')
  const [search, setSearch] = useState('')
  const { list, isLoading, error, mutate } = useBannerList({ state, search })
  const canManage = usePermission('banners:manage')
  const canPublish = usePermission('banners:publish')
  const [dragId, setDragId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const rows = list?.data ?? []
  // Reordering needs the full list (the service refuses partial orders).
  const filtered = state !== 'all' || search.trim() !== ''
  const canReorder = canManage && !filtered && rows.length > 1 && (list?.total ?? 0) <= rows.length
  const liveCount = rows.filter((b) => b.state === 'live').length

  async function applyOrder(next: BannerItem[]) {
    const previous = list
    setSaving(true)
    await mutate({ ...list!, data: next }, { revalidate: false }) // optimistic
    try {
      await bannerActions.reorder(next.map((b) => b.id))
      toast.success('Order saved')
    } catch (e) {
      toast.error((e as Error).message)
      await mutate(previous, { revalidate: false })
    } finally {
      setSaving(false)
      mutate()
    }
  }

  const move = (from: number, to: number) => {
    if (from < 0 || from >= rows.length || to < 0 || to >= rows.length || from === to) return
    const next = [...rows]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    applyOrder(next)
  }

  async function toggle(b: BannerItem) {
    try {
      await bannerActions.setEnabled(b.id, b.version, !b.isEnabled)
      toast.success(b.isEnabled ? `"${b.campaignName}" deactivated` : `"${b.campaignName}" activated`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      mutate()
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <CarouselSettingsCard liveCount={filtered ? null : liveCount} />

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3">
        <div className="min-w-[220px] flex-1">
          <Input label="Search" placeholder="Campaign or headline" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Status</label>
          <select className="h-9 rounded-md border border-gray-300 px-3 text-sm" value={state} onChange={(e) => setState(e.target.value as BannerState | 'all')}>
            <option value="all">All</option>
            {BANNER_STATES.map((s) => <option key={s} value={s}>{STATE_LABEL[s]}</option>)}
          </select>
        </div>
        {filtered && <button onClick={() => { setState('all'); setSearch('') }} className="h-9 px-3 text-sm text-gray-500 hover:text-gray-700">Clear filters</button>}
        {canManage && <Button onClick={() => router.push('/marketing/banners/new')}>New banner</Button>}
      </div>

      {canManage && rows.length > 1 && (
        <p className="text-xs text-gray-500">
          {canReorder
            ? 'Drag rows (or use the arrows) to set the order customers swipe through. The first live banner shows first.'
            : 'Clear the filters to reorder banners.'}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded bg-gray-100" />)}</div>
        ) : error ? (
          <div className="flex items-center justify-between p-4 text-sm text-red-600">
            <span>{(error as Error).message || 'Could not load banners'}</span>
            <Button variant="secondary" size="sm" onClick={() => mutate()}>Retry</Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <Megaphone size={22} className="text-gray-300" />
            <p className="text-sm font-medium text-gray-800">{filtered ? 'No banners match these filters' : 'No banners yet'}</p>
            <p className="max-w-sm text-xs text-gray-500">
              {filtered ? 'Try another status or search.' : 'Until a banner is live, the customer app shows its built-in "10% off your first booking" banner.'}
            </p>
            {canManage && !filtered && <Button className="mt-2" onClick={() => router.push('/marketing/banners/new')}>Create the first banner</Button>}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                {canReorder && <th className="w-16 px-2 py-2" aria-label="Order" />}
                <th className="px-3 py-2 text-left font-medium">Banner</th>
                <th className="px-3 py-2 text-left font-medium">Destination</th>
                <th className="px-3 py-2 text-left font-medium">Schedule (PKT)</th>
                <th className="px-3 py-2 text-right font-medium">Impr.</th>
                <th className="px-3 py-2 text-right font-medium">CTR</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                {canPublish && <th className="px-3 py-2 text-left font-medium">Active</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((b, i) => (
                <tr
                  key={b.id}
                  draggable={canReorder && !saving}
                  onDragStart={() => setDragId(b.id)}
                  onDragOver={(e) => canReorder && e.preventDefault()}
                  onDrop={() => { const from = rows.findIndex((r) => r.id === dragId); setDragId(null); move(from, i) }}
                  onDragEnd={() => setDragId(null)}
                  className={`border-t border-gray-100 hover:bg-gray-50 ${dragId === b.id ? 'opacity-50' : ''}`}
                >
                  {canReorder && (
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-0.5 text-gray-400">
                        <GripVertical size={14} className="cursor-grab" aria-hidden />
                        <button aria-label="Move up" disabled={i === 0 || saving} onClick={() => move(i, i - 1)} className="rounded p-0.5 hover:bg-gray-100 disabled:opacity-30"><ArrowUp size={13} /></button>
                        <button aria-label="Move down" disabled={i === rows.length - 1 || saving} onClick={() => move(i, i + 1)} className="rounded p-0.5 hover:bg-gray-100 disabled:opacity-30"><ArrowDown size={13} /></button>
                      </div>
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <Link href={`/marketing/banners/${b.id}`} className="flex items-center gap-3">
                      {b.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.imageUrl} alt="" className="h-10 w-20 shrink-0 rounded object-cover" />
                      ) : (
                        <span className="flex h-10 w-20 shrink-0 items-center justify-center rounded bg-gray-100 text-gray-300"><ImageIcon size={16} /></span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-gray-900">{b.campaignName}</span>
                        <span className="block truncate text-xs text-gray-500">{b.title}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {CTA_ACTION_META[b.ctaActionType].label}
                    {b.ctaEnabled && b.ctaLabel && <span className="block text-gray-400">Button: {b.ctaLabel}</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-600">
                    {b.startsAt ? formatPkt(b.startsAt) : 'On publish'}
                    <span className="block text-gray-400">{b.expiresAt ? `until ${formatPkt(b.expiresAt)}` : 'no end'}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-700">{b.impressions.toLocaleString('en-PK')}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-700">{ctr(b)}</td>
                  <td className="px-3 py-2"><Badge tone={STATE_TONE[b.state]}>{STATE_LABEL[b.state]}</Badge></td>
                  {canPublish && (
                    <td className="px-3 py-2">
                      {b.status === 'PUBLISHED' && b.state !== 'expired' ? (
                        <button
                          role="switch"
                          aria-checked={b.isEnabled}
                          aria-label={b.isEnabled ? 'Deactivate' : 'Activate'}
                          onClick={() => toggle(b)}
                          className={`relative h-5 w-9 rounded-full transition-colors ${b.isEnabled ? 'bg-[#1F6F5F]' : 'bg-gray-300'}`}
                        >
                          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${b.isEnabled ? 'left-[18px]' : 'left-0.5'}`} />
                        </button>
                      ) : <span className="text-xs text-gray-300">—</span>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
