'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ImagePlus, RefreshCw, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { usePermission } from '@/hooks/usePermission'
import { bannerActions } from '@/hooks/useBanners'
import {
  BADGE_SUGGESTIONS, CTA_ACTION_META, SELECTABLE_CTA_ACTIONS, CTA_STYLE_LABEL, CTA_STYLES, IMAGE_POSITIONS, IMAGE_RULES, LIMITS,
  STATE_HINT, STATE_LABEL, formatPkt, type CtaAction,
} from '@/lib/banner-constants'
import type { BannerDetail, BannerFormValues } from '@/types/banner'
import BannerPreview from './BannerPreview'
import BannerStatsPanel from './BannerStatsPanel'
import TargetPicker from './TargetPicker'
import { STATE_TONE } from './BannersSection'
import { EMPTY_BANNER_FORM, fromBanner, toPayload, validateBannerForm } from '@/lib/banner-form'

/** Reads the image size in the browser so a wrong-shaped image is caught before uploading. */
function readDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url) }
    img.onerror = () => { reject(new Error('This file is not a readable image')); URL.revokeObjectURL(url) }
    img.src = url
  })
}

function Field({ label, error, count, max, children, hint }: {
  label: string; error?: string; count?: number; max?: number; children: React.ReactNode; hint?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <label className="text-xs font-medium text-gray-700">{label}</label>
        {max !== undefined && <span className={`text-[11px] tabular-nums ${count! > max ? 'text-red-600' : 'text-gray-400'}`}>{count}/{max}</span>}
      </div>
      {children}
      {error ? <p className="text-xs text-red-600">{error}</p> : hint ? <p className="text-xs text-gray-400">{hint}</p> : null}
    </div>
  )
}

const inputCls = 'h-9 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-[#1F6F5F] focus:outline-none focus:ring-2 focus:ring-[#1F6F5F] disabled:bg-gray-50'

export default function BannerEditor({ banner, onChanged }: { banner?: BannerDetail; onChanged?: () => void }) {
  const router = useRouter()
  const canManage = usePermission('banners:manage')
  const canPublish = usePermission('banners:publish')
  const canDelete = usePermission('banners:delete')

  const initial = useMemo(() => (banner ? fromBanner(banner) : EMPTY_BANNER_FORM), [banner])
  const [v, setV] = useState<BannerFormValues>(initial)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [confirm, setConfirm] = useState<'delete' | 'unpublish' | null>(null)
  const [phone, setPhone] = useState<328 | 380>(328)
  const fileRef = useRef<HTMLInputElement>(null)

  // Re-sync after a save/refresh brings a newer version from the server.
  const [syncedVersion, setSyncedVersion] = useState(banner?.version)
  if (banner && banner.version !== syncedVersion) {
    setSyncedVersion(banner.version)
    setV(fromBanner(banner))
  }

  const set = <K extends keyof BannerFormValues>(k: K, val: BannerFormValues[K]) => setV((p) => ({ ...p, [k]: val }))
  const errors = validateBannerForm(v)
  const shown = touched ? errors : {}
  const dirty = JSON.stringify(v) !== JSON.stringify(initial)
  const readOnly = !canManage
  const meta = CTA_ACTION_META[v.ctaActionType]

  async function pickImage(file: File | undefined) {
    if (!file) return
    if (!(IMAGE_RULES.types as readonly string[]).includes(file.type)) return toast.error('Use a JPEG, PNG or WebP image')
    if (file.size > IMAGE_RULES.maxMb * 1024 * 1024) return toast.error(`The image is larger than ${IMAGE_RULES.maxMb} MB`)
    try {
      const d = await readDimensions(file)
      const ratio = d.width / d.height
      if (d.width < IMAGE_RULES.minWidth) return toast.error(`The image must be at least ${IMAGE_RULES.minWidth} px wide (this one is ${d.width} px)`)
      if (ratio < IMAGE_RULES.minRatio || ratio > IMAGE_RULES.maxRatio) {
        return toast.error(`Use a wide image, about 2:1 (recommended ${IMAGE_RULES.recommended}). This one is ${d.width} x ${d.height}.`)
      }
      setUploading(true)
      const out = await bannerActions.uploadImage(file)
      setV((p) => ({ ...p, imageUrl: out.url, imagePublicId: out.publicId, imageWidth: out.width, imageHeight: out.height }))
      toast.success('Image uploaded. Save to keep it.')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  /** Saves and returns the fresh version, or null when nothing was saved. */
  async function save(): Promise<number | null> {
    setTouched(true)
    if (Object.keys(errors).length) {
      toast.error('Fix the highlighted fields first')
      return null
    }
    setBusy('save')
    try {
      if (!banner) {
        const { data } = await bannerActions.create(toPayload(v))
        toast.success('Draft saved')
        router.replace(`/marketing/banners/${data.id}`)
        return data.version
      }
      const { data } = await bannerActions.update(banner.id, { ...toPayload(v), version: banner.version })
      toast.success('Changes saved')
      onChanged?.()
      return data.version
    } catch (e) {
      toast.error((e as Error).message)
      return null
    } finally {
      setBusy(null)
    }
  }

  async function publish() {
    if (!banner) return
    let version = banner.version
    if (dirty) {
      const saved = await save()
      if (saved === null) return
      version = saved
    }
    setBusy('publish')
    try {
      const { data } = await bannerActions.publish(banner.id, version)
      toast.success(data.state === 'scheduled' ? `Published. Goes live ${formatPkt(data.startsAt)}.` : 'Published. It is live in the app now.')
      onChanged?.()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function toggleEnabled() {
    if (!banner) return
    setBusy('status')
    try {
      await bannerActions.setEnabled(banner.id, banner.version, !banner.isEnabled)
      toast.success(banner.isEnabled ? 'Deactivated. Hidden from customers.' : 'Activated')
      onChanged?.()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-gray-900">{banner ? banner.campaignName : 'New banner'}</h1>
            {banner && <Badge tone={STATE_TONE[banner.state]}>{STATE_LABEL[banner.state]}</Badge>}
            {dirty && <span className="text-xs text-amber-700">Unsaved changes</span>}
          </div>
          <p className="text-sm text-gray-500">
            {banner ? STATE_HINT[banner.state] : 'Customer app home screen carousel. Saved as a draft until you publish.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {banner && canDelete && (
            <Button variant="ghost" onClick={() => setConfirm('delete')} disabled={!!busy}>
              <Trash2 size={14} /> Delete
            </Button>
          )}
          {banner?.status === 'PUBLISHED' && canPublish && banner.state !== 'expired' && (
            <Button variant="secondary" onClick={toggleEnabled} loading={busy === 'status'} disabled={!!busy || dirty}
              title={dirty ? 'Save your changes first' : undefined}>
              {banner.isEnabled ? 'Deactivate' : 'Activate'}
            </Button>
          )}
          {banner?.status === 'PUBLISHED' && canPublish && (
            <Button variant="secondary" onClick={() => setConfirm('unpublish')} disabled={!!busy}>Unpublish</Button>
          )}
          {canManage && (
            <Button variant={banner?.status === 'DRAFT' ? 'secondary' : 'primary'} onClick={save} loading={busy === 'save'}
              disabled={!!busy || uploading || (!!banner && !dirty)}>
              {banner ? 'Save changes' : 'Save draft'}
            </Button>
          )}
          {banner?.status === 'DRAFT' && canPublish && (
            <Button onClick={publish} loading={busy === 'publish'} disabled={!!busy || uploading}>
              {dirty ? 'Save & publish' : 'Publish'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* Form */}
        <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-5">
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Campaign</h2>
            <div className="grid grid-cols-1 gap-3">
              <Field label="Campaign name (internal)" error={shown.campaignName} count={v.campaignName.length} max={LIMITS.campaignName}>
                <input className={inputCls} value={v.campaignName} onChange={(e) => set('campaignName', e.target.value)} placeholder="First booking discount, Nov 2026" />
              </Field>
              <Field label="Notes (internal, optional)" error={shown.internalNotes} count={v.internalNotes.length} max={LIMITS.internalNotes}>
                <textarea className={`${inputCls} h-16 py-2`} value={v.internalNotes} onChange={(e) => set('internalNotes', e.target.value)} placeholder="Never shown to customers" />
              </Field>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Banner content</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Badge (optional)" error={shown.badgeText} count={v.badgeText.length} max={LIMITS.badgeText}>
                <input className={inputCls} value={v.badgeText} onChange={(e) => set('badgeText', e.target.value.toUpperCase())} placeholder="SPECIAL OFFER" />
                <div className="flex flex-wrap gap-1">
                  {BADGE_SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => set('badgeText', s)}
                      className="rounded border border-gray-200 px-1.5 py-0.5 text-[11px] text-gray-600 hover:bg-gray-50">{s}</button>
                  ))}
                </div>
              </Field>
              <Field label="Offer text (optional)" error={shown.offerText} count={v.offerText.length} max={LIMITS.offerText}
                hint="Highlighted in green. Put the same words in the headline to highlight them in place.">
                <input className={inputCls} value={v.offerText} onChange={(e) => set('offerText', e.target.value)} placeholder="10% Off" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Headline" error={shown.title} count={v.title.length} max={LIMITS.title} hint="Two lines at most on the phone.">
                  <input className={inputCls} value={v.title} onChange={(e) => set('title', e.target.value)} placeholder="Get 10% Off on Your First Booking" />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Subtitle / tagline (optional)" error={shown.subtitle} count={v.subtitle.length} max={LIMITS.subtitle} hint="One line; longer text is cut with an ellipsis.">
                  <input className={inputCls} value={v.subtitle} onChange={(e) => set('subtitle', e.target.value)} placeholder="Quality service, right at your doorstep." />
                </Field>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-1 text-sm font-semibold text-gray-900">Image</h2>
            <p className="mb-3 text-xs text-gray-500">
              JPEG, PNG or WebP, up to {IMAGE_RULES.maxMb} MB, at least {IMAGE_RULES.minWidth} px wide. Recommended {IMAGE_RULES.recommended}.
              Text sits on the left over a dark fade, so keep the subject on the right.
            </p>
            <input ref={fileRef} type="file" accept={IMAGE_RULES.types.join(',')} className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} />
            {v.imageUrl ? (
              <div className="flex flex-wrap items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.imageUrl} alt="Banner image" className="h-20 w-40 rounded-md border border-gray-200 object-cover" />
                <div className="flex flex-col gap-1 text-xs text-gray-500">
                  {v.imageWidth && v.imageHeight && <span>{v.imageWidth} x {v.imageHeight} px</span>}
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} loading={uploading}><RefreshCw size={12} /> Replace</Button>
                    {banner?.status !== 'PUBLISHED' && (
                      <Button size="sm" variant="ghost" onClick={() => setV((p) => ({ ...p, imageUrl: null, imagePublicId: null, imageWidth: null, imageHeight: null }))}>Remove</Button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); pickImage(e.dataTransfer.files?.[0]) }}
                disabled={uploading || readOnly}
                className="flex h-28 w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-gray-300 text-sm text-gray-500 hover:bg-gray-50"
              >
                {uploading ? <Upload size={18} className="animate-pulse" /> : <ImagePlus size={18} />}
                {uploading ? 'Uploading…' : 'Choose or drop an image'}
              </button>
            )}
            <div className="mt-3 max-w-xs">
              <Field label="Focus" hint="Which part of the image stays visible on narrow phones.">
                <select className={inputCls} value={v.imagePosition} onChange={(e) => set('imagePosition', e.target.value as BannerFormValues['imagePosition'])}>
                  {IMAGE_POSITIONS.map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
                </select>
              </Field>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Button & destination</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="When tapped, open" error={shown.ctaActionType} hint={meta.hint}>
                  <select className={inputCls} value={v.ctaActionType}
                    onChange={(e) => { const a = e.target.value as CtaAction; setV((p) => ({ ...p, ctaActionType: a, ctaParams: {}, ctaEnabled: a === 'NONE' ? false : p.ctaEnabled })) }}>
                    {SELECTABLE_CTA_ACTIONS.map((a) => <option key={a} value={a}>{CTA_ACTION_META[a].label}</option>)}
                  </select>
                </Field>
              </div>
              {meta.param && (
                <div className="sm:col-span-2">
                  <Field label={meta.param.kind === 'url' ? 'Link' : 'Destination'} error={shown.ctaParams}>
                    {meta.param.kind === 'url' ? (
                      <input className={inputCls} value={v.ctaParams.url ?? ''} placeholder="https://tasklync.pk/offers"
                        onChange={(e) => set('ctaParams', { url: e.target.value })} />
                    ) : (
                      <TargetPicker kind={meta.param.kind} value={v.ctaParams[meta.param.key] ?? ''} disabled={readOnly}
                        onChange={(id) => set('ctaParams', { [meta.param!.key]: id })} />
                    )}
                  </Field>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2">
                <input type="checkbox" className="accent-[#1F6F5F]" checked={v.ctaEnabled} disabled={v.ctaActionType === 'NONE'}
                  onChange={(e) => set('ctaEnabled', e.target.checked)} />
                Show a button
                <span className="text-xs text-gray-400">(without it, a tap anywhere on the banner still opens the destination)</span>
              </label>
              {v.ctaEnabled && v.ctaActionType !== 'NONE' && (
                <>
                  <Field label="Button text" error={shown.ctaLabel} count={v.ctaLabel.length} max={LIMITS.ctaLabel}>
                    <input className={inputCls} value={v.ctaLabel} onChange={(e) => set('ctaLabel', e.target.value)} placeholder="Book Now" />
                  </Field>
                  <Field label="Button style">
                    <select className={inputCls} value={v.ctaStyle} onChange={(e) => set('ctaStyle', e.target.value as BannerFormValues['ctaStyle'])}>
                      {CTA_STYLES.map((s) => <option key={s} value={s}>{CTA_STYLE_LABEL[s]}</option>)}
                    </select>
                  </Field>
                </>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-1 text-sm font-semibold text-gray-900">Schedule</h2>
            <p className="mb-3 text-xs text-gray-500">Pakistan time (PKT, UTC+5). Leave the start empty to go live on publish, and the end empty to run until you stop it.</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Starts" type="datetime-local" value={v.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
              <Input label="Ends" type="datetime-local" value={v.expiresAt} error={shown.expiresAt} onChange={(e) => set('expiresAt', e.target.value)} />
            </div>
          </section>
        </fieldset>

        {/* Preview */}
        <aside className="flex flex-col gap-4 xl:sticky xl:top-4 xl:self-start">
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Preview</h2>
              <div className="flex rounded-md border border-gray-300 p-0.5 text-xs">
                {([328, 380] as const).map((w) => (
                  <button key={w} type="button" onClick={() => setPhone(w)}
                    className={`h-6 rounded px-2 ${phone === w ? 'bg-[#1F6F5F]/10 font-medium text-[#1F6F5F]' : 'text-gray-500'}`}>
                    {w === 328 ? 'Small phone' : 'Large phone'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-center rounded-md bg-[#F7F8F7] px-4 py-6">
              <BannerPreview
                width={phone}
                title={v.title}
                subtitle={v.subtitle}
                badgeText={v.badgeText}
                offerText={v.offerText}
                imageUrl={v.imageUrl}
                imagePosition={v.imagePosition}
                cta={v.ctaEnabled && v.ctaActionType !== 'NONE' ? { label: v.ctaLabel, style: v.ctaStyle } : null}
              />
            </div>
            <p className="mt-2 text-xs text-gray-400">Actual size in the customer app (156 px tall). If several banners are live they swipe, with dots below.</p>
          </section>

          {banner && (
            <section className="rounded-lg border border-gray-200 bg-white p-4 text-xs text-gray-600">
              <dl className="grid grid-cols-[110px_1fr] gap-y-1.5">
                <dt className="text-gray-400">Window</dt>
                <dd>{banner.startsAt ? formatPkt(banner.startsAt) : 'On publish'} → {banner.expiresAt ? formatPkt(banner.expiresAt) : 'No end'}</dd>
                <dt className="text-gray-400">Published</dt><dd>{formatPkt(banner.publishedAt)}</dd>
                <dt className="text-gray-400">Created</dt><dd>{formatPkt(banner.createdAt)} by {banner.createdByEmail}</dd>
                <dt className="text-gray-400">Last change</dt><dd>{formatPkt(banner.updatedAt)}{banner.updatedByEmail ? ` by ${banner.updatedByEmail}` : ''}</dd>
              </dl>
            </section>
          )}
        </aside>
      </div>

      {banner && <BannerStatsPanel stats={banner.stats} />}

      <ConfirmDialog
        open={confirm === 'delete'}
        title="Delete this banner?"
        description={`"${banner?.campaignName}" is removed from the app immediately and from this list. Its statistics are kept for reporting.`}
        confirmLabel="Delete banner"
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          await bannerActions.remove(banner!.id)
          toast.success('Banner deleted')
          router.replace('/marketing/banners')
        }}
      />
      <ConfirmDialog
        open={confirm === 'unpublish'}
        title="Unpublish this banner?"
        description="It disappears from the customer app within a minute and goes back to draft. You can publish it again later."
        confirmLabel="Unpublish"
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          await bannerActions.unpublish(banner!.id, banner!.version)
          toast.success('Unpublished')
          onChanged?.()
        }}
      />
    </div>
  )
}
