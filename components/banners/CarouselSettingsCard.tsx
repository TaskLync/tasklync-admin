'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { usePermission } from '@/hooks/usePermission'
import { bannerActions, usePlacementSettings } from '@/hooks/useBanners'

/** Home carousel behaviour: applies to every banner in the placement. */
export default function CarouselSettingsCard({ liveCount }: { liveCount: number | null }) {
  const { settings, mutate } = usePlacementSettings()
  const canManage = usePermission('banners:manage')
  const [edit, setEdit] = useState<{ auto: boolean; seconds: string; max: string } | null>(null)
  const [busy, setBusy] = useState(false)

  if (!settings) return <div className="h-16 animate-pulse rounded-lg bg-gray-100" />

  const seconds = Number(edit?.seconds)
  const max = Number(edit?.max)
  const valid = !edit || (seconds >= 2 && seconds <= 15 && Number.isInteger(max) && max >= 1 && max <= 10)

  async function save() {
    if (!edit || !valid) return
    setBusy(true)
    try {
      await bannerActions.updatePlacement({ autoSlideEnabled: edit.auto, autoSlideIntervalMs: Math.round(seconds * 1000), maxBanners: max })
      toast.success('Carousel settings saved')
      setEdit(null)
      mutate()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
      <div className="text-sm">
        <p className="font-medium text-gray-900">
          Home carousel{liveCount === null ? "" : liveCount === 0 ? " · no banner live (the app shows its built-in banner)" : ` · ${liveCount} live`}
        </p>
        {!edit && (
          <p className="text-xs text-gray-500">
            {settings.autoSlideEnabled ? `Auto-slides every ${settings.autoSlideIntervalMs / 1000}s` : 'Manual swipe only'} · shows up to {settings.maxBanners} banners
          </p>
        )}
      </div>
      {edit ? (
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <label className="flex items-center gap-2 text-gray-700">
            <input type="checkbox" className="accent-[#1F6F5F]" checked={edit.auto} onChange={(e) => setEdit({ ...edit, auto: e.target.checked })} />
            Auto-slide
          </label>
          <label className="flex flex-col text-xs text-gray-700">
            Every (seconds, 2–15)
            <input type="number" min={2} max={15} step={0.5} disabled={!edit.auto} className="mt-1 h-8 w-24 rounded-md border border-gray-300 px-2 text-sm"
              value={edit.seconds} onChange={(e) => setEdit({ ...edit, seconds: e.target.value })} />
          </label>
          <label className="flex flex-col text-xs text-gray-700">
            Max banners (1–10)
            <input type="number" min={1} max={10} className="mt-1 h-8 w-24 rounded-md border border-gray-300 px-2 text-sm"
              value={edit.max} onChange={(e) => setEdit({ ...edit, max: e.target.value })} />
          </label>
          <Button variant="secondary" size="sm" onClick={() => setEdit(null)} disabled={busy}>Cancel</Button>
          <Button size="sm" onClick={save} loading={busy} disabled={!valid}>Save</Button>
        </div>
      ) : canManage ? (
        <Button variant="secondary" size="sm" onClick={() => setEdit({
          auto: settings.autoSlideEnabled, seconds: String(settings.autoSlideIntervalMs / 1000), max: String(settings.maxBanners),
        })}>Carousel settings</Button>
      ) : null}
    </div>
  )
}
