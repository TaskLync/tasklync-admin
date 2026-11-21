'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Check, ChevronDown, RotateCcw, Type } from 'lucide-react'
import {
  BUNDLED_FAMILY, DESIGN_LIMITS, LEGACY, LEGACY_COLORS, WEIGHT_LABEL, customFaceName, pickVariant,
  type BannerDesign, type BadgeDesign, type CtaDesign, type DesignBox, type DesignElement, type DesignFontFamily,
  type DesignSize, type TextDesign,
} from '@/lib/banner-design'
import { loadCustomFace } from '@/lib/font-loader'
import './app-fonts.css'

type Tab = DesignElement | 'layout'
const TABS: { key: Tab; label: string }[] = [
  { key: 'headline', label: 'Headline' },
  { key: 'subtitle', label: 'Subtitle' },
  { key: 'badge', label: 'Badge' },
  { key: 'cta', label: 'Button' },
  { key: 'layout', label: 'Layout' },
]

const inputCls = 'h-8 w-full rounded-md border border-gray-300 px-2 text-sm tabular-nums focus:border-[#1F6F5F] focus:outline-none focus:ring-2 focus:ring-[#1F6F5F]/40 disabled:bg-gray-50'
const labelCls = 'text-[11px] font-medium text-gray-600'

const DEFAULT_FAMILY_NAME: Record<string, string> = {
  [BUNDLED_FAMILY.poppins]: 'Poppins', [BUNDLED_FAMILY.jakarta]: 'Plus Jakarta Sans', [BUNDLED_FAMILY.inter]: 'Inter',
}

/** Removes undefined keys so an untouched control leaves no trace in the saved design. */
function clean<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T
}

// ─── small controls ──────────────────────────────────────────────────────────

function Group({ title, children, defaultOpen = true, onReset }: { title: string; children: ReactNode; defaultOpen?: boolean; onReset?: () => void }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-md border border-gray-200">
      <div className="flex items-center justify-between px-3 py-2">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 text-xs font-semibold text-gray-800">
          <ChevronDown size={14} className={`transition-transform ${open ? '' : '-rotate-90'}`} /> {title}
        </button>
        {onReset && (
          <button type="button" onClick={onReset} className="text-[11px] text-gray-400 hover:text-gray-700" title={`Reset ${title.toLowerCase()}`}>
            Reset
          </button>
        )}
      </div>
      {open && <div className="grid grid-cols-2 gap-3 border-t border-gray-100 p-3 sm:grid-cols-3">{children}</div>}
    </div>
  )
}

function Num({ label, value, onChange, placeholder, range, step = 1, suffix, span }: {
  label: string; value: number | undefined; onChange: (v: number | undefined) => void; placeholder: number | string
  range: readonly [number, number]; step?: number; suffix?: string; span?: boolean
}) {
  const bad = value !== undefined && (value < range[0] || value > range[1])
  return (
    <label className={`flex flex-col gap-1 ${span ? 'col-span-2' : ''}`}>
      <span className={labelCls}>{label}</span>
      <div className="relative">
        <input
          type="number" inputMode="decimal" step={step} min={range[0]} max={range[1]}
          className={`${inputCls} ${suffix ? 'pr-7' : ''} ${bad ? 'border-red-400' : ''}`}
          value={value ?? ''} placeholder={String(placeholder)}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        />
        {suffix && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">{suffix}</span>}
      </div>
      {bad && <span className="text-[11px] text-red-600">{range[0]}–{range[1]}</span>}
    </label>
  )
}

function Select<T extends string | number>({ label, value, onChange, options, placeholder }: {
  label: string; value: T | undefined; onChange: (v: T | undefined) => void; options: { value: T; label: string }[]; placeholder: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className={labelCls}>{label}</span>
      <select
        className={inputCls}
        value={value === undefined ? '' : String(value)}
        onChange={(e) => {
          if (e.target.value === '') return onChange(undefined)
          const opt = options.find((o) => String(o.value) === e.target.value)
          onChange(opt?.value)
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
      </select>
    </label>
  )
}

function Color({ label, value, onChange, placeholder }: { label: string; value: string | undefined; onChange: (v: string | undefined) => void; placeholder: string }) {
  const [draft, setDraft] = useState(value ?? '')
  const [synced, setSynced] = useState(value)
  if (value !== synced) { setSynced(value); setDraft(value ?? '') }
  const valid = (s: string) => /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(s)
  return (
    <label className="flex flex-col gap-1">
      <span className={labelCls}>{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="color" aria-label={`${label} picker`}
          className="h-8 w-9 shrink-0 cursor-pointer rounded border border-gray-300 bg-white p-0.5"
          value={(value ?? placeholder).slice(0, 7)}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
        />
        <input
          className={`${inputCls} font-mono text-xs ${draft && !valid(draft) ? 'border-red-400' : ''}`}
          value={draft} placeholder={placeholder}
          onChange={(e) => {
            const s = e.target.value.trim()
            setDraft(s)
            if (s === '') onChange(undefined)
            else if (valid(s)) onChange(s.toUpperCase())
          }}
        />
      </div>
    </label>
  )
}

function UnitToggle({ value, onChange }: { value: '%' | undefined; onChange: (u: '%' | undefined) => void }) {
  return (
    <div className="flex rounded border border-gray-300 p-0.5 text-[11px]">
      {([undefined, '%'] as const).map((u) => (
        <button key={u ?? 'dp'} type="button" onClick={() => onChange(u)}
          className={`h-5 rounded px-1.5 ${value === u ? 'bg-[#1F6F5F]/10 font-medium text-[#1F6F5F]' : 'text-gray-500'}`}>
          {u ?? 'dp'}
        </button>
      ))}
    </div>
  )
}

/** Four sides + unit. Placeholders show the built-in values; an empty side keeps the built-in value. */
function BoxField({ label, value, onChange, base }: {
  label: string; value: DesignBox | undefined; onChange: (v: DesignBox | undefined) => void
  base: { top: number; right: number; bottom: number; left: number }
}) {
  const unit = value?.unit
  const range = unit === '%' ? DESIGN_LIMITS.spacingPct : DESIGN_LIMITS.spacingDp
  const set = (side: keyof typeof base, n: number | undefined) => {
    const next = clean({ ...value, [side]: n })
    onChange(Object.keys(next).some((k) => k !== 'unit') ? next : undefined)
  }
  return (
    <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-3">
      <div className="flex items-center justify-between">
        <span className={labelCls}>{label}</span>
        <UnitToggle value={unit} onChange={(u) => onChange(clean({ ...value, unit: u }))} />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
          <Num key={side} label={side[0].toUpperCase() + side.slice(1)} value={value?.[side]} onChange={(n) => set(side, n)}
            placeholder={unit === '%' ? '–' : base[side]} range={range} suffix={unit === '%' ? '%' : undefined} />
        ))}
      </div>
    </div>
  )
}

function SizeField({ label, value, onChange, dp, pct, placeholder }: {
  label: string; value: DesignSize | undefined; onChange: (v: DesignSize | undefined) => void
  dp: readonly [number, number]; pct: readonly [number, number]; placeholder: string
}) {
  const unit = value?.unit ?? 'dp'
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className={labelCls}>{label}</span>
        <UnitToggle value={unit === '%' ? '%' : undefined}
          onChange={(u) => value && onChange({ value: value.value, unit: u === '%' ? '%' : 'dp' })} />
      </div>
      <Num label="" value={value?.value} placeholder={placeholder} range={unit === '%' ? pct : dp} suffix={unit === '%' ? '%' : 'dp'}
        onChange={(n) => onChange(n === undefined ? undefined : { value: n, unit })} />
    </div>
  )
}

/** Dropdown that draws every family in its own face (regular weight). */
function FontPicker({ fonts, value, onChange, defaultFamilyId }: {
  fonts: DesignFontFamily[]; value: string | undefined; onChange: (id: string | undefined) => void; defaultFamilyId: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [, force] = useState(0)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    // Load each custom family's regular face for the sample.
    for (const f of fonts) {
      const v = pickVariant(f, 400, 'normal')
      if (v?.url && v.format) loadCustomFace(v.id, v.url, v.format).then(() => force((n) => n + 1))
    }
    return () => document.removeEventListener('mousedown', close)
  }, [open, fonts])

  const faceOf = (f: DesignFontFamily) => {
    const v = pickVariant(f, 400, 'normal')
    return v?.appFontName ?? (v ? customFaceName(v.id) : undefined)
  }
  const selected = value ? fonts.find((f) => f.id === value) : undefined
  const missing = value && !selected

  return (
    <div ref={ref} className="relative col-span-2 flex flex-col gap-1">
      <span className={labelCls}>Font family</span>
      <button type="button" onClick={() => setOpen((o) => !o)}
        className={`${inputCls} flex items-center justify-between text-left ${missing ? 'border-amber-400' : ''}`}>
        <span className="truncate" style={{ fontFamily: selected ? `'${faceOf(selected)}'` : undefined }}>
          {selected ? selected.name : missing ? 'Font not available (app uses default)' : `Default (${DEFAULT_FAMILY_NAME[defaultFamilyId]})`}
        </span>
        <ChevronDown size={14} className="shrink-0 text-gray-400" />
      </button>
      {open && (
        <div className="absolute top-full z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
          <button type="button" onClick={() => { onChange(undefined); setOpen(false) }}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50">
            <span>Default <span className="text-gray-400">({DEFAULT_FAMILY_NAME[defaultFamilyId]})</span></span>
            {!value && <Check size={14} className="text-[#1F6F5F]" />}
          </button>
          {fonts.map((f) => (
            <button key={f.id} type="button" onClick={() => { onChange(f.id); setOpen(false) }}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-gray-50">
              <span className="min-w-0">
                <span className="block truncate text-base text-gray-900" style={{ fontFamily: `'${faceOf(f)}'` }}>{f.name}</span>
                <span className="text-[11px] text-gray-400">
                  {f.source === 'BUNDLED' ? 'Built into the app' : 'Uploaded'} · {f.variants.length} weight{f.variants.length === 1 ? '' : 's'}
                </span>
              </span>
              {value === f.id && <Check size={14} className="shrink-0 text-[#1F6F5F]" />}
            </button>
          ))}
          <Link href="/settings/brand/fonts" className="mt-1 flex items-center gap-1.5 border-t border-gray-100 px-3 py-2 text-xs text-[#1F6F5F] hover:bg-gray-50">
            <Type size={12} /> Manage the font library
          </Link>
        </div>
      )}
    </div>
  )
}

// ─── element editors ─────────────────────────────────────────────────────────

type AnyEl = TextDesign & BadgeDesign & CtaDesign
const BASE = { headline: LEGACY.headline, subtitle: LEGACY.subtitle, badge: LEGACY.badge, cta: LEGACY.cta }
const FONT_SIZE = {
  headline: DESIGN_LIMITS.headline.fontSize, subtitle: DESIGN_LIMITS.subtitle.fontSize,
  badge: DESIGN_LIMITS.badge.fontSize, cta: DESIGN_LIMITS.cta.fontSize,
}
const ALIGN_OPTIONS = [{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }] as const
const TRANSFORM_OPTIONS = [
  { value: 'none', label: 'As typed' }, { value: 'uppercase', label: 'UPPERCASE' },
  { value: 'lowercase', label: 'lowercase' }, { value: 'capitalize', label: 'Capitalize Each' },
] as const

function ElementEditor({ el, value, onChange, fonts, ctaStyle }: {
  el: DesignElement; value: AnyEl; onChange: (v: AnyEl) => void; fonts: DesignFontFamily[]; ctaStyle: 'ON_DARK' | 'BRAND'
}) {
  const base = BASE[el]
  const set = <K extends keyof AnyEl>(k: K, v: AnyEl[K]) => onChange(clean({ ...value, [k]: v }))
  const reset = (...keys: (keyof AnyEl)[]) => onChange(clean(Object.fromEntries(Object.entries(value).filter(([k]) => !keys.includes(k as keyof AnyEl))) as AnyEl))

  const family = value.font_family_id ? fonts.find((f) => f.id === value.font_family_id) : fonts.find((f) => f.id === base.familyId)
  const weights = useMemo(() => {
    const ws = [...new Set((family?.variants ?? []).filter((v) => v.style === (value.font_style ?? 'normal')).map((v) => v.weight))]
    const all = ws.length ? ws : [...new Set((family?.variants ?? []).map((v) => v.weight))]
    return all.sort((a, b) => a - b)
  }, [family, value.font_style])
  const hasItalic = family?.variants.some((v) => v.style === 'italic')
  const colorPlaceholder = el === 'headline' ? LEGACY_COLORS.headline : el === 'subtitle' ? LEGACY_COLORS.subtitle
    : el === 'badge' ? LEGACY_COLORS.badge : ctaStyle === 'BRAND' ? LEGACY_COLORS.ctaBrand : LEGACY_COLORS.ctaOnDark
  const isText = el === 'headline' || el === 'subtitle'

  return (
    <div className="flex flex-col gap-3">
      <Group title="Typography" onReset={() => reset('font_family_id', 'font_weight', 'font_style', 'font_size', 'line_height', 'letter_spacing', 'text_transform', 'color')}>
        <FontPicker fonts={fonts} value={value.font_family_id} defaultFamilyId={base.familyId}
          onChange={(id) => onChange(clean({ ...value, font_family_id: id, font_weight: undefined }))} />
        <Select label="Weight" value={value.font_weight} placeholder={`Default (${WEIGHT_LABEL[base.weight]})`}
          options={weights.map((w) => ({ value: w, label: `${WEIGHT_LABEL[w] ?? w} (${w})` }))} onChange={(w) => set('font_weight', w)} />
        <Select label="Style" value={value.font_style} placeholder="Normal"
          options={[{ value: 'italic', label: hasItalic ? 'Italic' : 'Italic (slanted, no italic file)' }]}
          onChange={(s) => set('font_style', s as AnyEl['font_style'])} />
        <Num label="Font size" value={value.font_size} placeholder={base.size} range={FONT_SIZE[el]} step={0.5} suffix="dp"
          onChange={(n) => set('font_size', n)} />
        {el !== 'badge' && el !== 'cta' && (
          <Num label="Line height" value={value.line_height} placeholder={value.font_size ? 'auto' : base.lineHeight}
            range={DESIGN_LIMITS.lineHeight} step={0.5} suffix="dp" onChange={(n) => set('line_height', n)} />
        )}
        <Num label="Letter spacing" value={value.letter_spacing} placeholder={base.letterSpacing} range={DESIGN_LIMITS.letterSpacing}
          step={0.1} onChange={(n) => set('letter_spacing', n)} />
        <Select label="Text case" value={value.text_transform} placeholder={`Default (${base.transform === 'uppercase' ? 'UPPERCASE' : 'as typed'})`}
          options={TRANSFORM_OPTIONS.map((o) => ({ ...o }))} onChange={(t) => set('text_transform', t as AnyEl['text_transform'])} />
        <Color label="Text colour" value={value.color} placeholder={colorPlaceholder} onChange={(c) => set('color', c)} />
        {(el === 'badge' || el === 'cta') && (
          <Color label={el === 'cta' ? 'Button colour' : 'Badge colour'} value={value.background_color}
            placeholder={el === 'badge' ? LEGACY_COLORS.badgeBackground : ctaStyle === 'BRAND' ? LEGACY_COLORS.ctaBrandBackground : LEGACY_COLORS.ctaOnDarkBackground}
            onChange={(c) => set('background_color', c)} />
        )}
      </Group>

      <Group title={el === 'cta' ? 'Size & position' : 'Alignment & size'}
        onReset={() => reset('text_align', 'max_width', 'max_lines', 'width', 'height', 'border_radius', 'align')}>
        <Select label={el === 'badge' ? 'Badge position' : el === 'cta' ? 'Label alignment' : 'Text alignment'} value={value.text_align}
          placeholder={el === 'cta' ? 'Default (Center)' : 'Default (Left)'} options={ALIGN_OPTIONS.map((o) => ({ ...o }))}
          onChange={(a) => set('text_align', a as AnyEl['text_align'])} />
        {isText && (
          <>
            <Num label="Max lines" value={value.max_lines} placeholder={el === 'headline' ? 2 : 1}
              range={DESIGN_LIMITS[el].maxLines} onChange={(n) => set('max_lines', n)} />
            <SizeField label="Max width" value={value.max_width} placeholder="column" dp={DESIGN_LIMITS.maxWidthDp} pct={DESIGN_LIMITS.maxWidthPct}
              onChange={(s) => set('max_width', s)} />
          </>
        )}
        {el === 'cta' && (
          <>
            <Select label="Horizontal position" value={value.align} placeholder="Default (Left)"
              options={[{ value: 'START', label: 'Left' }, { value: 'CENTER', label: 'Center' }, { value: 'END', label: 'Right' }]}
              onChange={(a) => set('align', a as AnyEl['align'])} />
            <SizeField label="Width" value={value.width} placeholder="auto (min 92)" dp={DESIGN_LIMITS.cta.width} pct={DESIGN_LIMITS.widthPct}
              onChange={(s) => set('width', s)} />
            <Num label="Height" value={value.height} placeholder={LEGACY.cta.height} range={DESIGN_LIMITS.cta.height} suffix="dp"
              onChange={(n) => set('height', n)} />
            <p className="col-span-2 self-end text-[11px] text-gray-400 sm:col-span-3">
              Vertical position: Layout → Vertical arrangement (button at the bottom or right under the text), then fine-tune with the
              button&apos;s top / bottom margin below.
            </p>
          </>
        )}
        {(el === 'cta' || el === 'badge') && (
          <Num label="Corner radius" value={value.border_radius} placeholder={el === 'cta' ? LEGACY.cta.radius : LEGACY.badge.radius}
            range={DESIGN_LIMITS.radius} suffix="dp" onChange={(n) => set('border_radius', n)} />
        )}
      </Group>

      <Group title="Spacing" onReset={() => reset('margin', 'padding')}>
        <BoxField label={el === 'cta' ? 'Button margin (outside)' : 'Margin (outside)'} value={value.margin} base={base.margin}
          onChange={(b) => set('margin', b)} />
        <BoxField label={el === 'cta' ? 'Button padding (inside)' : 'Padding (inside)'} value={value.padding} base={base.padding}
          onChange={(b) => set('padding', b)} />
      </Group>
    </div>
  )
}

function LayoutEditor({ value, onChange }: { value: NonNullable<BannerDesign['layout']>; onChange: (v: BannerDesign['layout']) => void }) {
  const set = <K extends keyof typeof value>(k: K, v: (typeof value)[K]) => onChange(clean({ ...value, [k]: v }))
  return (
    <div className="flex flex-col gap-3">
      <Group title="Content area" onReset={() => onChange(undefined)}>
        <Select label="Vertical arrangement" value={value.justify} placeholder="Default (text top, button bottom)"
          options={[
            { value: 'START', label: 'Top' }, { value: 'CENTER', label: 'Centered' },
            { value: 'END', label: 'Bottom' }, { value: 'SPACE_BETWEEN', label: 'Text top, button bottom' },
          ]}
          onChange={(j) => set('justify', j as typeof value.justify)} />
        <SizeField label="Text column width" value={value.text_max_width} placeholder="62%, max 240" dp={DESIGN_LIMITS.maxWidthDp}
          pct={DESIGN_LIMITS.maxWidthPct} onChange={(s) => set('text_max_width', s)} />
        <BoxField label="Banner padding" value={value.padding} base={LEGACY.layout.padding} onChange={(b) => set('padding', b)} />
      </Group>
      <p className="text-xs text-gray-400">
        Text sits over a dark fade on the left. Keep the column narrow enough that it does not run over the image subject.
      </p>
    </div>
  )
}

// ─── panel ───────────────────────────────────────────────────────────────────

export default function DesignPanel({ value, onChange, fonts, ctaStyle, ctaShown, error, overflow }: {
  value: BannerDesign; onChange: (v: BannerDesign) => void; fonts: DesignFontFamily[]; ctaStyle: 'ON_DARK' | 'BRAND'
  ctaShown: boolean; error?: string; overflow: boolean
}) {
  const [tab, setTab] = useState<Tab>('headline')
  const customised = (k: Tab) => !!value[k] && Object.keys(value[k] as object).length > 0
  const anything = TABS.some((t) => customised(t.key))
  const setPart = (k: Tab, v: unknown) => onChange(clean({ ...value, [k]: v && Object.keys(v as object).length ? v : undefined }) as BannerDesign)

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Design & typography</h2>
        {anything && (
          <button type="button" onClick={() => onChange({})} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
            <RotateCcw size={12} /> Reset all to default
          </button>
        )}
      </div>
      <p className="mb-3 text-xs text-gray-500">
        Empty fields keep the standard banner look (shown as grey hints). Sizes are in dp, the phone&apos;s density-independent unit (1 dp = 1 px in this preview, scaled per screen density on the device); % is a share of the parent&apos;s width.
      </p>

      <div className="mb-3 flex gap-1 overflow-x-auto border-b border-gray-200">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-medium ${
              tab === t.key ? 'border-[#1F6F5F] text-[#1F6F5F]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            {t.label}
            {customised(t.key) && <span className="h-1.5 w-1.5 rounded-full bg-[#1F6F5F]" aria-label="customised" />}
          </button>
        ))}
      </div>

      {tab === 'cta' && !ctaShown && (
        <p className="mb-3 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">The button is hidden for this banner. These settings apply when it is shown.</p>
      )}
      {tab === 'layout'
        ? <LayoutEditor value={value.layout ?? {}} onChange={(v) => setPart('layout', v)} />
        : <ElementEditor key={tab} el={tab} value={(value[tab] ?? {}) as AnyEl} fonts={fonts} ctaStyle={ctaStyle}
            onChange={(v) => setPart(tab, v)} />}

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      {overflow && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          The content does not fit the 156 dp banner and would be cut off on the phone. Reduce a font size, spacing or the number of lines.
        </p>
      )}
    </section>
  )
}
