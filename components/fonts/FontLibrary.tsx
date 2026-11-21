'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { FileType, Pencil, Plus, Trash2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { usePermission } from '@/hooks/usePermission'
import { fontActions, useCustomFaces, useFontLibrary } from '@/hooks/useFontLibrary'
import { FONT_WEIGHTS, WEIGHT_LABEL, customFaceName, type FontStyle } from '@/lib/banner-design'
import { formatPkt } from '@/lib/banner-constants'
import type { FontFamily, FontVariant } from '@/types/font'
import '@/components/banners/app-fonts.css'

const MAX_MB = 2
const inputCls = 'h-9 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-[#1F6F5F] focus:outline-none focus:ring-2 focus:ring-[#1F6F5F]/40'

/** Best guess of weight / style from a file name like "Brand-SemiBoldItalic.ttf". The admin can change it. */
export function guessFace(filename: string): { weight: number; style: FontStyle } {
  const n = filename.toLowerCase().replace(/[\s_-]/g, '')
  const style: FontStyle = /italic|oblique/.test(n) ? 'italic' : 'normal'
  const rules: [RegExp, number][] = [
    [/thin|hairline/, 100], [/extralight|ultralight/, 200], [/semibold|demibold/, 600], [/extrabold|ultrabold/, 800],
    [/black|heavy/, 900], [/light/, 300], [/medium/, 500], [/bold/, 700],
  ]
  return { weight: rules.find(([re]) => re.test(n))?.[1] ?? 400, style }
}

const kb = (b: number | null) => (b ? `${Math.max(1, Math.round(b / 1024))} KB` : '')
const faceName = (v: FontVariant) => v.appFontName ?? customFaceName(v.id)

function FileRows({ rows, setRows }: {
  rows: { file: File; weight: number; style: FontStyle }[]
  setRows: (r: { file: File; weight: number; style: FontStyle }[]) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const add = (files: FileList | null) => {
    const next = [...rows]
    for (const f of Array.from(files ?? [])) {
      if (!/\.(ttf|otf)$/i.test(f.name)) { toast.error(`${f.name}: use a .ttf or .otf file (WOFF does not load in the app)`); continue }
      if (f.size > MAX_MB * 1024 * 1024) { toast.error(`${f.name} is larger than ${MAX_MB} MB`); continue }
      next.push({ file: f, ...guessFace(f.name) })
    }
    setRows(next)
    if (ref.current) ref.current.value = ''
  }
  return (
    <div className="flex flex-col gap-2">
      <input ref={ref} type="file" accept=".ttf,.otf" multiple className="hidden" onChange={(e) => add(e.target.files)} />
      {rows.map((r, i) => (
        <div key={`${r.file.name}-${i}`} className="grid grid-cols-[minmax(0,1fr)_130px_100px_28px] items-center gap-2 text-sm">
          <span className="truncate text-gray-700" title={r.file.name}>{r.file.name} <span className="text-xs text-gray-400">{kb(r.file.size)}</span></span>
          <select className={`${inputCls} h-8`} value={r.weight}
            onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) } : x)))}>
            {FONT_WEIGHTS.map((w) => <option key={w} value={w}>{WEIGHT_LABEL[w]} ({w})</option>)}
          </select>
          <select className={`${inputCls} h-8`} value={r.style}
            onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, style: e.target.value as FontStyle } : x)))}>
            <option value="normal">Normal</option>
            <option value="italic">Italic</option>
          </select>
          <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600" aria-label="Remove file">
            <X size={14} />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => ref.current?.click()}
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); add(e.dataTransfer.files) }}
        className="flex h-16 flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-gray-300 text-xs text-gray-500 hover:bg-gray-50">
        <Upload size={14} /> Choose or drop .ttf / .otf files (one per weight, up to {MAX_MB} MB each)
      </button>
    </div>
  )
}

/** Uploads each file in turn; returns how many succeeded. Failures are shown and do not stop the rest. */
async function uploadAll(id: string, rows: { file: File; weight: number; style: FontStyle }[]) {
  let ok = 0
  for (const r of rows) {
    try {
      await fontActions.uploadVariant(id, r.file, r.weight, r.style)
      ok++
    } catch (e) {
      toast.error(`${r.file.name}: ${(e as Error).message}`)
    }
  }
  return ok
}

function AddFontDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rows, setRows] = useState<{ file: File; weight: number; style: FontStyle }[]>([])
  const [activate, setActivate] = useState(true)
  const [busy, setBusy] = useState(false)
  if (!open) return null

  async function submit() {
    if (name.trim().length < 2) return toast.error('Enter the font family name')
    if (!rows.length) return toast.error('Add at least one font file')
    const dupes = new Set<string>()
    for (const r of rows) {
      const k = `${r.weight}-${r.style}`
      if (dupes.has(k)) return toast.error(`Two files are set to ${WEIGHT_LABEL[r.weight]} ${r.style}`)
      dupes.add(k)
    }
    setBusy(true)
    try {
      const { data } = await fontActions.create({ name: name.trim(), description: description.trim() || null })
      const ok = await uploadAll(data.id, rows)
      if (ok > 0 && activate) {
        const fresh = await fetch(`/api/admin/fonts/${data.id}`).then((r) => r.json())
        await fontActions.setActive(data.id, fresh.data.version, true)
      }
      toast.success(ok === rows.length ? `${name.trim()} added${activate ? ' and activated' : ''}` : `${ok} of ${rows.length} files uploaded`)
      setName(''); setDescription(''); setRows([])
      onDone()
      onClose()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-xl rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Add a font</h2>
        <p className="mt-1 text-sm text-gray-600">
          Upload the .ttf or .otf file for each weight you want to use. Only fonts you have the licence to use in an app.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-700">Family name</span>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Brand Sans" maxLength={60} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-700">Note (optional)</span>
            <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Eid campaign display face" maxLength={200} />
          </label>
          <FileRows rows={rows} setRows={setRows} />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" className="accent-[#1F6F5F]" checked={activate} onChange={(e) => setActivate(e.target.checked)} />
            Activate now (it appears in the banner editor straight away)
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} loading={busy}>Add font</Button>
        </div>
      </div>
    </div>
  )
}

/** Mounted per font (keyed by id), so its fields start from that font. */
function EditDialog({ font, onClose, onDone }: { font: FontFamily; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(font.name)
  const [description, setDescription] = useState(font.description ?? '')
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<{ file: File; weight: number; style: FontStyle }[]>([])
  const builtIn = font.source === 'BUNDLED'

  async function submit() {
    setBusy(true)
    try {
      if (name.trim() !== font!.name || (description.trim() || null) !== font!.description) {
        await fontActions.update(font!.id, {
          version: font!.version, name: builtIn ? undefined : name.trim(), description: description.trim() || null,
        })
      }
      if (rows.length) {
        const ok = await uploadAll(font!.id, rows)
        if (ok) toast.success(`${ok} file${ok > 1 ? 's' : ''} uploaded`)
      } else {
        toast.success('Saved')
      }
      onDone()
      onClose()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-xl rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Edit {font.name}</h2>
        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-700">Family name</span>
            <input className={inputCls} value={name} disabled={builtIn} onChange={(e) => setName(e.target.value)} maxLength={60} />
            {builtIn && <span className="text-xs text-gray-400">Built-in fonts keep their name.</span>}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-700">Note</span>
            <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />
          </label>
          {!builtIn && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-700">Add weights</span>
              <FileRows rows={rows} setRows={setRows} />
            </div>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} loading={busy}>Save</Button>
        </div>
      </div>
    </div>
  )
}

function FontCard({ font, sample, canManage, onEdit, onChanged }: {
  font: FontFamily; sample: string; canManage: boolean; onEdit: () => void; onChanged: () => void
}) {
  const [confirm, setConfirm] = useState<'delete' | { variant: FontVariant } | null>(null)
  const [busy, setBusy] = useState(false)
  const faces = useCustomFaces(font.variants.filter((v) => v.fileUrl && v.format)
    .map((v) => ({ variantId: v.id, url: v.fileUrl!, format: v.format! })))
  const builtIn = font.source === 'BUNDLED'

  async function toggle() {
    setBusy(true)
    try {
      await fontActions.setActive(font.id, font.version, !font.isActive)
      toast.success(font.isActive ? `${font.name} deactivated` : `${font.name} activated`)
      onChanged()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="rounded-lg border border-gray-200 bg-white">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900">{font.name}</h3>
            <Badge tone={font.isActive ? 'success' : 'neutral'}>{font.isActive ? 'Active' : 'Inactive'}</Badge>
            {builtIn ? <Badge tone="info">Built into the app</Badge> : <Badge>Uploaded</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {font.description ? `${font.description} · ` : ''}
            {builtIn ? 'Ships inside the customer app, no download.' : `Added ${formatPkt(font.createdAt)}${font.createdByEmail ? ` by ${font.createdByEmail}` : ''}`}
            {font.usedBy > 0 && ` · Used by ${font.usedBy} banner${font.usedBy > 1 ? 's' : ''}${font.usedByPublished ? ` (${font.usedByPublished} published)` : ''}`}
          </p>
        </div>
        {canManage && (
          <div className="flex gap-1.5">
            <Button size="sm" variant="ghost" onClick={onEdit}><Pencil size={12} /> {builtIn ? 'Edit note' : 'Edit / add weights'}</Button>
            <Button size="sm" variant="secondary" onClick={toggle} loading={busy}
              disabled={!font.isActive && font.variants.length === 0}
              title={!font.isActive && font.variants.length === 0 ? 'Upload a font file first' : undefined}>
              {font.isActive ? 'Deactivate' : 'Activate'}
            </Button>
            {!builtIn && (
              <Button size="sm" variant="ghost" onClick={() => setConfirm('delete')} aria-label={`Delete ${font.name}`}><Trash2 size={12} /></Button>
            )}
          </div>
        )}
      </header>

      {font.variants.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-gray-400">No files yet. Use “Edit / add weights” to upload one.</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {font.variants.map((v) => {
            const st = v.fileUrl ? faces[v.id] : 'loaded'
            return (
              <li key={v.id} className="grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5">
                <div className="text-xs">
                  <div className="font-medium text-gray-800">{WEIGHT_LABEL[v.weight] ?? v.weight} {v.style === 'italic' ? 'Italic' : ''}</div>
                  <div className="text-gray-400">{v.weight}{v.format ? ` · ${v.format.toUpperCase()}` : ''}{v.fileBytes ? ` · ${kb(v.fileBytes)}` : ''}</div>
                </div>
                <p className="truncate text-xl text-gray-900" style={{ fontFamily: st === 'loaded' ? `'${faceName(v)}'` : undefined }} title={sample}>
                  {st === 'failed' ? <span className="text-sm text-red-600">This file could not be loaded in the browser.</span> : sample}
                </p>
                {canManage && !builtIn ? (
                  <button type="button" onClick={() => setConfirm({ variant: v })} className="text-gray-300 hover:text-red-600" aria-label="Remove this weight">
                    <X size={14} />
                  </button>
                ) : <span />}
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={confirm === 'delete'}
        title={`Delete ${font.name}?`}
        description="Its files are removed from storage. Fonts still used by a banner cannot be deleted: change those banners first."
        confirmLabel="Delete font"
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          await fontActions.remove(font.id)
          toast.success(`${font.name} deleted`)
          onChanged()
        }}
      />
      <ConfirmDialog
        open={!!confirm && confirm !== 'delete'}
        title="Remove this weight?"
        description={confirm && confirm !== 'delete'
          ? `${WEIGHT_LABEL[confirm.variant.weight]} ${confirm.variant.style} is removed. Banners asking for it use the nearest remaining weight.` : ''}
        confirmLabel="Remove"
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          if (!confirm || confirm === 'delete') return
          await fontActions.removeVariant(font.id, confirm.variant.id)
          toast.success('Weight removed')
          onChanged()
        }}
      />
    </article>
  )
}

export default function FontLibrary() {
  const canManage = usePermission('fonts:manage')
  const { fonts, isLoading, error, mutate } = useFontLibrary(false)
  const [sample, setSample] = useState('Get 10% off your first booking')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<FontFamily | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex min-w-[260px] flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-gray-700">Preview text</span>
          <input className={inputCls} value={sample} onChange={(e) => setSample(e.target.value || 'Aa Bb Cc 123')} />
        </label>
        {canManage && <Button onClick={() => setAdding(true)}><Plus size={14} /> Add font</Button>}
      </div>

      <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
        <FileType size={12} className="mr-1 inline" />
        Accepted: TrueType (.ttf) and OpenType (.otf), up to {MAX_MB} MB per weight. WOFF / WOFF2 are web-only and do not load in the
        mobile app, so they are refused. Active fonts appear in every banner&apos;s Design &amp; typography font lists; the app downloads a
        font once, the first time a live banner uses it, and keeps it.
      </div>

      {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}
      {isLoading && !fonts.length ? (
        <div className="h-40 animate-pulse rounded-lg bg-gray-100" />
      ) : (
        <div className="flex flex-col gap-3">
          {fonts.map((f) => (
            <FontCard key={f.id} font={f} sample={sample} canManage={canManage} onEdit={() => setEditing(f)} onChanged={() => mutate()} />
          ))}
        </div>
      )}

      <AddFontDialog open={adding} onClose={() => setAdding(false)} onDone={() => mutate()} />
      {editing && <EditDialog key={editing.id} font={editing} onClose={() => setEditing(null)} onDone={() => mutate()} />}
    </div>
  )
}
