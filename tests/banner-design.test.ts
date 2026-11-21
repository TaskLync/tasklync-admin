import { describe, expect, it } from 'vitest'
import {
  BUNDLED_FAMILY, compactDesign, customFaceName, pickVariant, resolveBannerDesign, validateDesign, type DesignFontFamily,
} from '@/lib/banner-design'
import { hasInvalidIdSegment } from '@/lib/auth/uuid-guard'
import { hasPermission, permissionForPath } from '@/lib/auth/rbac'

const CUSTOM = '44444444-4444-4444-8444-444444444444'
const V400 = '55555555-5555-4555-8555-555555555555'
const V700 = '66666666-6666-4666-8666-666666666666'
const VIT = '77777777-7777-4777-8777-777777777777'

const fonts: DesignFontFamily[] = [
  {
    id: BUNDLED_FAMILY.inter, name: 'Inter', source: 'BUNDLED',
    variants: [400, 500, 600, 700, 800].map((w, i) => ({
      id: `00000000-0000-4000-8000-00000000f30${i + 1}`, weight: w, style: 'normal' as const, format: null, url: null,
      appFontName: { 400: 'Inter-Regular', 500: 'Inter-Medium', 600: 'Inter-SemiBold', 700: 'Inter-Bold', 800: 'Inter-ExtraBold' }[w]!,
    })),
  },
  {
    id: CUSTOM, name: 'Brand Sans', source: 'CUSTOM',
    variants: [
      { id: V400, weight: 400, style: 'normal', format: 'ttf', url: 'https://res.cloudinary.com/tl/raw/upload/a.ttf', appFontName: null },
      { id: V700, weight: 700, style: 'normal', format: 'otf', url: 'https://res.cloudinary.com/tl/raw/upload/b.otf', appFontName: null },
      { id: VIT, weight: 400, style: 'italic', format: 'ttf', url: 'https://res.cloudinary.com/tl/raw/upload/c.ttf', appFontName: null },
    ],
  },
]

describe('banner design resolver', () => {
  it('reproduces the built-in banner exactly when nothing is customised (existing banners)', () => {
    for (const design of [null, undefined, {}]) {
      const r = resolveBannerDesign(design, fonts, 328)
      expect(r.layout).toEqual({
        padding: { top: 14, right: 18, bottom: 14, left: 18 }, justify: 'space-between', textMaxWidth: 203, stretchText: false,
      })
      expect(r.headline).toMatchObject({ fontSize: 16, lineHeight: 21, letterSpacing: -0.2, maxLines: 2, color: undefined })
      expect(r.headline.font).toEqual({ face: 'Poppins-Bold', fallbackFace: 'Poppins-Bold', custom: null, synthItalic: false })
      expect(r.subtitle.font.face).toBe('PlusJakartaSans-Medium')
      expect(r.subtitle).toMatchObject({ fontSize: 11.5, lineHeight: 15, maxLines: 1, margin: { top: 4, right: 0, bottom: 0, left: 0 } })
      expect(r.badge).toMatchObject({ fontSize: 9, lineHeight: 12, letterSpacing: 0.8, textTransform: 'uppercase', borderRadius: 6 })
      expect(r.badge.padding).toEqual({ top: 2, right: 7, bottom: 2, left: 7 })
      expect(r.cta).toMatchObject({ fontSize: 13, height: 36, minWidth: 92, borderRadius: 12, alignSelf: 'flex-start', justifyContent: 'center' })
      expect(r.cta.font.face).toBe('Poppins-SemiBold')
      expect(r.customFonts).toEqual([])
    }
    expect(resolveBannerDesign(null, fonts, 400).layout.textMaxWidth).toBe(240) // 62% capped at 240
  })

  it('applies the admin example: Inter Medium 15 subtitle, 26 headline with 12 / 8 margins, wider button padding', () => {
    const r = resolveBannerDesign({
      headline: { font_size: 26, margin: { top: 12, bottom: 8 } },
      subtitle: { font_family_id: BUNDLED_FAMILY.inter, font_weight: 500, font_size: 15 },
      cta: { font_family_id: CUSTOM, padding: { left: 24, right: 24 } },
    }, fonts, 328)
    expect(r.headline.fontSize).toBe(26)
    expect(r.headline.lineHeight).toBeCloseTo(34.1) // built-in 21/16 ratio, so the taller text is not clipped
    expect(r.headline.margin).toEqual({ top: 12, right: 0, bottom: 8, left: 0 })
    expect(r.subtitle.font.face).toBe('Inter-Medium')
    expect(r.cta.font.face).toBe(customFaceName(V700)) // SemiBold 600 -> nearest uploaded weight (ties go heavier)
    expect(r.cta.font.fallbackFace).toBe('Poppins-SemiBold')
    expect(r.cta.padding).toEqual({ top: 0, right: 24, bottom: 0, left: 24 })
    expect(r.customFonts).toEqual([{ variantId: V700, url: fonts[1].variants[1].url, format: 'otf' }])
  })

  it('picks italic files when they exist, otherwise slants the upright face', () => {
    expect(resolveBannerDesign({ headline: { font_family_id: CUSTOM, font_weight: 400, font_style: 'italic' } }, fonts, 328).headline.font)
      .toMatchObject({ face: customFaceName(VIT), synthItalic: false })
    expect(resolveBannerDesign({ headline: { font_family_id: CUSTOM, font_weight: 700, font_style: 'italic' } }, fonts, 328).headline.font)
      .toMatchObject({ face: customFaceName(VIT), synthItalic: false }) // italic beats weight
    expect(resolveBannerDesign({ headline: { font_style: 'italic' } }, fonts, 328).headline.font)
      .toMatchObject({ face: 'Poppins-Bold', synthItalic: true })
  })

  it('falls back to the built-in family when a chosen font is missing (deactivated / deleted)', () => {
    const r = resolveBannerDesign({ headline: { font_family_id: '99999999-9999-4999-8999-999999999999', font_weight: 500 } }, fonts, 328)
    expect(r.headline.font).toEqual({ face: 'Poppins-Medium', fallbackFace: 'Poppins-Medium', custom: null, synthItalic: false })
  })

  it('passes percentages through for both renderers and stretches aligned text', () => {
    const r = resolveBannerDesign({
      layout: { text_max_width: { value: 70, unit: '%' }, padding: { left: 5, unit: '%' } },
      headline: { text_align: 'center', max_width: { value: 90, unit: '%' } },
      cta: { width: { value: 50, unit: '%' }, align: 'END', text_align: 'left' },
    }, fonts, 328)
    expect(r.layout.textMaxWidth).toBe('70%')
    expect(r.layout.padding).toEqual({ top: 14, right: 18, bottom: 14, left: '5%' })
    expect(r.layout.stretchText).toBe(true)
    expect(r.headline.maxWidth).toBe('90%')
    expect(r.cta).toMatchObject({ width: '50%', minWidth: undefined, alignSelf: 'flex-end', justifyContent: 'flex-start' })
  })

  it('never lets the line height drop below the font size', () => {
    expect(resolveBannerDesign({ headline: { font_size: 30, line_height: 12 } }, fonts, 328).headline.lineHeight).toBe(30)
  })

  it('matches weights like CSS: same style first, nearest weight, ties heavier', () => {
    expect(pickVariant(fonts[1], 500, 'normal')?.id).toBe(V400)
    expect(pickVariant(fonts[1], 550, 'normal')?.id).toBe(V700)
    expect(pickVariant(fonts[1], 900, 'italic')?.id).toBe(VIT)
  })
})

describe('design editor helpers', () => {
  it('sends an untouched design as null', () => {
    expect(compactDesign({})).toBeNull()
    expect(compactDesign({ headline: {}, cta: { margin: { unit: '%' } } })).toBeNull()
    expect(compactDesign({ headline: { font_size: 20 }, subtitle: {} })).toEqual({ headline: { font_size: 20 } })
  })
  it('catches out-of-range values before saving', () => {
    expect(validateDesign({ headline: { font_size: 40 } })).toMatch(/Headline font size/)
    expect(validateDesign({ cta: { padding: { left: 30, unit: '%' } } })).toMatch(/Button spacing/)
    expect(validateDesign({ subtitle: { color: 'red' } })).toMatch(/colour/)
    expect(validateDesign({ headline: { font_size: 26, margin: { top: 12 } } })).toBeNull()
  })
})

describe('font library access', () => {
  it('guards the routes and ids', () => {
    expect(permissionForPath('/settings/brand/fonts')).toBe('fonts:view')
    expect(permissionForPath('/settings')).toBe('settings:view')
    expect(hasPermission('OPS', 'fonts:manage')).toBe(true)
    expect(hasPermission('SUPPORT', 'fonts:manage')).toBe(false)
    expect(hasPermission('SUPPORT', 'fonts:view')).toBe(true)
    expect(hasInvalidIdSegment('/api/admin/fonts/not-a-uuid')).toBe(true)
    expect(hasInvalidIdSegment(`/api/admin/fonts/${CUSTOM}/variants/${V400}`)).toBe(false)
  })
})
