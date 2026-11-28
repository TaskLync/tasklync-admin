// lib/banner-design.ts  (client + server safe, pure)
//
// Banner typography / spacing: the shape stored in promo_banners.design_config, the built-in look it
// overrides, and the resolver that turns (design, font library, banner width) into concrete styles.
//
// The customer app has a line-for-line twin of resolveBannerDesign() in src/utils/bannerDesign.ts, so the
// admin preview and the phone compute the same numbers. Change both together.
// Rules mirror booking-service (validators/banner-design.validators.ts), which is the authority.

export type SizeUnit = 'dp' | '%'
/** Spacing on four sides. No unit = dp (CSS px in the preview: same logical unit); '%' = of the parent's width. */
export interface DesignBox { top?: number; right?: number; bottom?: number; left?: number; unit?: '%' }
export interface DesignSize { value: number; unit: SizeUnit }
export type TextAlign = 'left' | 'center' | 'right'
export type TextTransform = 'none' | 'uppercase' | 'lowercase' | 'capitalize'
export type FontStyle = 'normal' | 'italic'

interface FontFields {
  font_family_id?: string
  font_weight?: number
  font_style?: FontStyle
  font_size?: number
  letter_spacing?: number
  color?: string
}
export interface TextDesign extends FontFields {
  line_height?: number
  text_align?: TextAlign
  text_transform?: TextTransform
  margin?: DesignBox
  padding?: DesignBox
  max_width?: DesignSize
  max_lines?: number
}
export interface BadgeDesign extends FontFields {
  text_align?: TextAlign
  text_transform?: TextTransform
  background_color?: string
  border_radius?: number
  margin?: DesignBox
  padding?: DesignBox
}
export interface CtaDesign extends FontFields {
  text_align?: TextAlign
  text_transform?: TextTransform
  background_color?: string
  width?: DesignSize
  height?: number
  border_radius?: number
  margin?: DesignBox
  padding?: DesignBox
  align?: 'START' | 'CENTER' | 'END'
}
export interface BannerDesign {
  layout?: { padding?: DesignBox; justify?: 'SPACE_BETWEEN' | 'START' | 'CENTER' | 'END'; text_max_width?: DesignSize }
  headline?: TextDesign
  subtitle?: TextDesign
  badge?: BadgeDesign
  cta?: CtaDesign
}
export type DesignElement = 'headline' | 'subtitle' | 'badge' | 'cta'

export interface DesignFontVariant {
  id: string
  weight: number
  style: FontStyle
  format: 'ttf' | 'otf' | null
  url: string | null
  appFontName: string | null
}
export interface DesignFontFamily {
  id: string
  name: string
  source: 'BUNDLED' | 'CUSTOM'
  variants: DesignFontVariant[]
}

// ─── Limits (mirror booking-service DESIGN_LIMITS) ────────────────────────────

export const DESIGN_LIMITS = {
  headline: { fontSize: [10, 32], maxLines: [1, 3] },
  subtitle: { fontSize: [8, 22], maxLines: [1, 3] },
  badge: { fontSize: [7, 16] },
  cta: { fontSize: [9, 20], height: [28, 56], width: [60, 320] },
  lineHeight: [8, 48],
  letterSpacing: [-2, 6],
  spacingDp: [0, 48],
  spacingPct: [0, 25],
  maxWidthDp: [40, 400],
  maxWidthPct: [20, 100],
  widthPct: [20, 100],
  radius: [0, 40],
} as const

export const FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const
export const WEIGHT_LABEL: Record<number, string> = {
  100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium',
  600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black',
}

// ─── The built-in look (src/components/home/PromoBannerSlide.tsx + BookNowButton.tsx) ─────

/** Faces the app bundles (src/config/fonts.ts), by font_families id (seeded in migration 023). */
export const BUNDLED_FAMILY = {
  poppins: '00000000-0000-4000-8000-00000000f001',
  jakarta: '00000000-0000-4000-8000-00000000f002',
  inter: '00000000-0000-4000-8000-00000000f003',
} as const
const BUNDLED_FACES: Record<string, Record<number, string>> = {
  [BUNDLED_FAMILY.poppins]: { 400: 'Poppins-Regular', 500: 'Poppins-Medium', 600: 'Poppins-SemiBold', 700: 'Poppins-Bold', 800: 'Poppins-ExtraBold' },
  [BUNDLED_FAMILY.jakarta]: { 400: 'PlusJakartaSans-Regular', 500: 'PlusJakartaSans-Medium', 600: 'PlusJakartaSans-SemiBold', 700: 'PlusJakartaSans-Bold' },
  [BUNDLED_FAMILY.inter]: { 400: 'Inter-Regular', 500: 'Inter-Medium', 600: 'Inter-SemiBold', 700: 'Inter-Bold', 800: 'Inter-ExtraBold' },
}

type Sides = { top: number; right: number; bottom: number; left: number }
const Z: Sides = { top: 0, right: 0, bottom: 0, left: 0 }

export const LEGACY = {
  layout: { padding: { top: 14, right: 18, bottom: 14, left: 18 } as Sides, justify: 'SPACE_BETWEEN' as const },
  headline: {
    familyId: BUNDLED_FAMILY.poppins, weight: 700, size: 16, lineHeight: 21, letterSpacing: -0.2,
    maxLines: 2, margin: Z, padding: Z, transform: 'none' as TextTransform,
  },
  subtitle: {
    familyId: BUNDLED_FAMILY.jakarta, weight: 500, size: 11.5, lineHeight: 15, letterSpacing: 0,
    maxLines: 1, margin: { ...Z, top: 4 }, padding: Z, transform: 'none' as TextTransform,
  },
  badge: {
    familyId: BUNDLED_FAMILY.poppins, weight: 700, size: 9, lineHeight: 12, letterSpacing: 0.8,
    margin: { ...Z, bottom: 5 }, padding: { top: 2, right: 7, bottom: 2, left: 7 }, radius: 6, transform: 'uppercase' as TextTransform,
  },
  cta: {
    familyId: BUNDLED_FAMILY.poppins, weight: 600, size: 13, lineHeight: 18, letterSpacing: 0.1,
    height: 36, minWidth: 92, margin: Z, padding: { top: 0, right: 16, bottom: 0, left: 16 }, radius: 12,
    transform: 'none' as TextTransform,
  },
} as const

/** What each element's colours look like when not overridden (light theme), for editor placeholders. */
export const LEGACY_COLORS = {
  headline: '#FFFFFF', subtitle: '#FFFFFFE0', badge: '#4ADE80', badgeBackground: '#4ADE8029',
  ctaOnDark: '#111827', ctaOnDarkBackground: '#FFFFFF', ctaBrand: '#FFFFFF', ctaBrandBackground: '#15803D',
}

// ─── Resolver ────────────────────────────────────────────────────────────────

/** A length the renderer passes through: a number (dp / px) or a percentage string. */
export type Len = number | `${number}%`
export interface ResolvedFont {
  /** The face to render with once available (custom faces need loading first). */
  face: string
  /** A bundled face of the nearest weight: shown while a custom face loads, or if it fails. */
  fallbackFace: string
  /** Set when `face` is an uploaded font the renderer must load (and from where). */
  custom: { variantId: string; url: string; format: 'ttf' | 'otf' } | null
  /** Requested italic but the family has no italic file: the renderer slants the upright face. */
  synthItalic: boolean
}
export interface ResolvedText {
  font: ResolvedFont
  fontSize: number
  lineHeight: number
  letterSpacing: number
  textTransform: TextTransform
  /** undefined = keep the element's built-in (theme-aware) colour. */
  color?: string | undefined
  textAlign?: TextAlign | undefined
  margin: Record<keyof Sides, Len>
  padding: Record<keyof Sides, Len>
  maxWidth?: Len | undefined
  maxLines?: number | undefined
}
export interface ResolvedBanner {
  layout: { padding: Record<keyof Sides, Len>; justify: 'space-between' | 'flex-start' | 'center' | 'flex-end'; textMaxWidth: Len; stretchText: boolean }
  headline: ResolvedText
  subtitle: ResolvedText
  badge: ResolvedText & { backgroundColor?: string | undefined; borderRadius: number; alignSelf: 'flex-start' | 'center' | 'flex-end' }
  cta: ResolvedText & {
    backgroundColor?: string | undefined; width?: Len | undefined; minWidth?: number | undefined; height: number; borderRadius: number
    alignSelf: 'flex-start' | 'center' | 'flex-end'; justifyContent: 'flex-start' | 'center' | 'flex-end'
  }
  /** Every custom face this banner needs. */
  customFonts: NonNullable<ResolvedFont['custom']>[]
}

const nearest = <T extends { weight: number }>(list: T[], weight: number): T | undefined =>
  [...list].sort((a, b) => Math.abs(a.weight - weight) - Math.abs(b.weight - weight) || b.weight - a.weight)[0]

function bundledFace(familyId: string, weight: number): string {
  const faces = BUNDLED_FACES[familyId] ?? BUNDLED_FACES[BUNDLED_FAMILY.poppins]
  const w = nearest(Object.keys(faces).map((k) => ({ weight: Number(k) })), weight)!.weight
  return faces[w]
}

/** Registered name of an uploaded face (expo-font in the app, FontFace in the preview). */
export const customFaceName = (variantId: string) => `tlf_${variantId.replace(/-/g, '')}`

/** CSS-like matching: same style first, then the nearest weight (ties go heavier). */
export function pickVariant(family: DesignFontFamily, weight: number, style: FontStyle): DesignFontVariant | undefined {
  const sameStyle = family.variants.filter((v) => v.style === style)
  return nearest(sameStyle.length ? sameStyle : family.variants, weight)
}

export function resolveFont(
  fields: FontFields, defaults: { familyId: string; weight: number }, fonts: DesignFontFamily[],
): ResolvedFont {
  const weight = fields.font_weight ?? defaults.weight
  const style = fields.font_style ?? 'normal'
  const family = fields.font_family_id ? fonts.find((f) => f.id === fields.font_family_id) : undefined
  // The fallback keeps the element's own built-in family (or the chosen one when it is bundled).
  const fallbackFamily = family?.source === 'BUNDLED' && BUNDLED_FACES[family.id] ? family.id : defaults.familyId
  const fallbackFace = bundledFace(fallbackFamily, weight)
  const v = family ? pickVariant(family, weight, style) : undefined
  if (!family || !v) {
    return { face: fallbackFace, fallbackFace, custom: null, synthItalic: style === 'italic' }
  }
  const synthItalic = style === 'italic' && v.style !== 'italic'
  if (v.appFontName) return { face: v.appFontName, fallbackFace, custom: null, synthItalic }
  if (!v.url || !v.format) return { face: fallbackFace, fallbackFace, custom: null, synthItalic: style === 'italic' }
  return { face: customFaceName(v.id), fallbackFace, custom: { variantId: v.id, url: v.url, format: v.format }, synthItalic }
}

const pct = (n: number) => `${n}%` as `${number}%`
function sides(override: DesignBox | undefined, base: Sides): Record<keyof Sides, Len> {
  const out = {} as Record<keyof Sides, Len>
  for (const s of ['top', 'right', 'bottom', 'left'] as const) {
    const v = override?.[s]
    out[s] = v === undefined ? base[s] : override?.unit === '%' ? pct(v) : v
  }
  return out
}
const size = (s: DesignSize | undefined): Len | undefined => (s ? (s.unit === '%' ? pct(s.value) : s.value) : undefined)

function text(
  d: TextDesign | BadgeDesign | CtaDesign | undefined,
  base: { familyId: string; weight: number; size: number; lineHeight: number; letterSpacing: number; margin: Sides; padding: Sides; transform: TextTransform; maxLines?: number },
  fonts: DesignFontFamily[],
): ResolvedText {
  const fontSize = d?.font_size ?? base.size
  // A bigger font with the old line height would clip: scale the built-in ratio unless one is set.
  const lineHeight = (d as TextDesign | undefined)?.line_height
    ?? (d?.font_size !== undefined ? Math.round(fontSize * (base.lineHeight / base.size) * 10) / 10 : base.lineHeight)
  return {
    font: resolveFont(d ?? {}, base, fonts),
    fontSize,
    lineHeight: Math.max(lineHeight, Math.ceil(fontSize)),
    letterSpacing: d?.letter_spacing ?? base.letterSpacing,
    textTransform: d?.text_transform ?? base.transform,
    color: d?.color,
    textAlign: d?.text_align,
    margin: sides(d?.margin, base.margin),
    padding: sides(d?.padding, base.padding),
    maxWidth: size((d as TextDesign | undefined)?.max_width),
    maxLines: (d as TextDesign | undefined)?.max_lines ?? base.maxLines,
  }
}

const ALIGN_SELF = { left: 'flex-start', center: 'center', right: 'flex-end', START: 'flex-start', CENTER: 'center', END: 'flex-end' } as const
const JUSTIFY = { SPACE_BETWEEN: 'space-between', START: 'flex-start', CENTER: 'center', END: 'flex-end' } as const

/**
 * Concrete styles for one banner at one width. `design` null / {} gives exactly the built-in look.
 * `width` is the banner's width (phone width minus the 2 x 16 margins).
 */
export function resolveBannerDesign(design: BannerDesign | null | undefined, fonts: DesignFontFamily[], width: number): ResolvedBanner {
  const d = design ?? {}
  const headline = text(d.headline, LEGACY.headline, fonts)
  const subtitle = text(d.subtitle, LEGACY.subtitle, fonts)
  const badgeText = text(d.badge, LEGACY.badge, fonts)
  const ctaText = text(d.cta, LEGACY.cta, fonts)
  const stretchText = [d.headline?.text_align, d.subtitle?.text_align, d.badge?.text_align].some((a) => a && a !== 'left')

  const resolved: ResolvedBanner = {
    layout: {
      padding: sides(d.layout?.padding, LEGACY.layout.padding),
      justify: JUSTIFY[d.layout?.justify ?? LEGACY.layout.justify],
      textMaxWidth: size(d.layout?.text_max_width) ?? Math.min(Math.round(width * 0.62), 240),
      stretchText,
    },
    headline,
    subtitle,
    badge: {
      ...badgeText,
      maxLines: 1,
      backgroundColor: d.badge?.background_color,
      borderRadius: d.badge?.border_radius ?? LEGACY.badge.radius,
      alignSelf: ALIGN_SELF[d.badge?.text_align ?? 'left'],
    },
    cta: {
      ...ctaText,
      maxLines: 1,
      backgroundColor: d.cta?.background_color,
      width: size(d.cta?.width),
      minWidth: d.cta?.width ? undefined : LEGACY.cta.minWidth,
      height: d.cta?.height ?? LEGACY.cta.height,
      borderRadius: d.cta?.border_radius ?? LEGACY.cta.radius,
      alignSelf: ALIGN_SELF[d.cta?.align ?? 'START'],
      justifyContent: ALIGN_SELF[d.cta?.text_align ?? 'center'],
    },
    customFonts: [],
  }
  const seen = new Set<string>()
  for (const el of [resolved.headline, resolved.subtitle, resolved.badge, resolved.cta]) {
    const c = el.font.custom
    if (c && !seen.has(c.variantId)) { seen.add(c.variantId); resolved.customFonts.push(c) }
  }
  return resolved
}

// ─── Editor helpers ──────────────────────────────────────────────────────────

/** Removes empty objects so an untouched design is sent as null (= built-in look). */
export function compactDesign(d: BannerDesign | null | undefined): BannerDesign | null {
  const prune = (v: unknown): unknown => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return v
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v)) {
      const p = prune(val)
      if (p === undefined || p === null || p === '') continue
      if (typeof p === 'object' && !Array.isArray(p)) {
        const keys = Object.keys(p as object)
        if (keys.length === 0 || (keys.length === 1 && keys[0] === 'unit')) continue
      }
      out[k] = p
    }
    return out
  }
  const out = prune(d ?? {}) as BannerDesign
  return Object.keys(out).length ? out : null
}

/** Client-side checks mirroring booking-service, so the admin sees problems before saving. */
export function validateDesign(d: BannerDesign | null): string | null {
  if (!d) return null
  const inRange = (v: number | undefined, [min, max]: readonly [number, number]) => v === undefined || (v >= min && v <= max)
  const boxOk = (b: DesignBox | undefined) => {
    if (!b) return true
    const r = b.unit === '%' ? DESIGN_LIMITS.spacingPct : DESIGN_LIMITS.spacingDp
    return (['top', 'right', 'bottom', 'left'] as const).every((s) => inRange(b[s], r))
  }
  const sizeOk = (s: DesignSize | undefined, dp: readonly [number, number], pc: readonly [number, number]) =>
    !s || inRange(s.value, s.unit === '%' ? pc : dp)
  const els: [string, TextDesign | BadgeDesign | CtaDesign | undefined, readonly [number, number]][] = [
    ['Headline', d.headline, DESIGN_LIMITS.headline.fontSize], ['Subtitle', d.subtitle, DESIGN_LIMITS.subtitle.fontSize],
    ['Badge', d.badge, DESIGN_LIMITS.badge.fontSize], ['Button', d.cta, DESIGN_LIMITS.cta.fontSize],
  ]
  for (const [label, el, fs] of els) {
    if (!el) continue
    if (!inRange(el.font_size, fs)) return `${label} font size must be ${fs[0]}–${fs[1]}`
    if (!inRange(el.letter_spacing, DESIGN_LIMITS.letterSpacing)) return `${label} letter spacing must be ${DESIGN_LIMITS.letterSpacing.join('–')}`
    if (!inRange((el as TextDesign).line_height, DESIGN_LIMITS.lineHeight)) return `${label} line height must be ${DESIGN_LIMITS.lineHeight.join('–')}`
    if (!boxOk(el.margin) || !boxOk(el.padding)) return `${label} spacing must be 0–48 dp or 0–25%`
    if (!sizeOk((el as TextDesign).max_width, DESIGN_LIMITS.maxWidthDp, DESIGN_LIMITS.maxWidthPct)) return `${label} max width must be 40–400 dp or 20–100%`
    if (el.color && !/^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(el.color)) return `${label} colour must be #RRGGBB`
  }
  if (!inRange(d.headline?.max_lines, DESIGN_LIMITS.headline.maxLines)) return 'Headline lines must be 1–3'
  if (!inRange(d.subtitle?.max_lines, DESIGN_LIMITS.subtitle.maxLines)) return 'Subtitle lines must be 1–3'
  if (!inRange(d.cta?.height, DESIGN_LIMITS.cta.height)) return 'Button height must be 28–56'
  if (!sizeOk(d.cta?.width, DESIGN_LIMITS.cta.width, DESIGN_LIMITS.widthPct)) return 'Button width must be 60–320 dp or 20–100%'
  if (!inRange(d.cta?.border_radius, DESIGN_LIMITS.radius) || !inRange(d.badge?.border_radius, DESIGN_LIMITS.radius)) return 'Corner radius must be 0–40'
  if (!boxOk(d.layout?.padding)) return 'Banner padding must be 0–48 dp or 0–25%'
  if (!sizeOk(d.layout?.text_max_width, DESIGN_LIMITS.maxWidthDp, DESIGN_LIMITS.maxWidthPct)) return 'Text column width must be 40–400 dp or 20–100%'
  return null
}
