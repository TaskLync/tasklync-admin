import { describe, expect, it } from 'vitest'
import { fromPktInput, splitHeadline, toPktInput } from '@/lib/banner-constants'
import { bannerCreateSchema, bannerUpdateSchema, mapBanner, toServiceBody } from '@/lib/banners-api'
import { validateBannerForm } from '@/lib/banner-form'
import { hasInvalidIdSegment } from '@/lib/auth/uuid-guard'
import { hasPermission, permissionForPath } from '@/lib/auth/rbac'

const ID = '33333333-3333-4333-8333-333333333333'

describe('Pakistan time helpers', () => {
  it('round-trips a Karachi wall-clock time regardless of the browser zone', () => {
    expect(fromPktInput('2026-12-01T09:30')).toBe('2026-12-01T09:30:00+05:00')
    expect(toPktInput('2026-12-01T04:30:00.000Z')).toBe('2026-12-01T09:30')
    expect(toPktInput(fromPktInput('2026-12-31T23:59'))).toBe('2026-12-31T23:59')
  })
  it('treats empty or malformed input as no date', () => {
    expect(fromPktInput('')).toBeNull()
    expect(fromPktInput('tomorrow')).toBeNull()
    expect(toPktInput(null)).toBe('')
  })
})

describe('headline highlight', () => {
  it('highlights the offer inside the headline, case-insensitively', () => {
    expect(splitHeadline('Get 10% Off on Your First Booking', '10% off')).toEqual({
      before: 'Get ', highlight: '10% Off', after: ' on Your First Booking', inline: true,
    })
  })
  it('falls back to a plain headline when the offer is elsewhere', () => {
    expect(splitHeadline('Eid deals', 'Rs. 500 off').inline).toBe(false)
    expect(splitHeadline('Eid deals', '').inline).toBe(false)
  })
})

describe('editor validation', () => {
  const base = {
    campaignName: 'Eid', internalNotes: '', title: 'Eid offer', subtitle: '', badgeText: '', offerText: '',
    imageUrl: null, imagePublicId: null, imageWidth: null, imageHeight: null, imagePosition: 'RIGHT' as const,
    ctaEnabled: true, ctaLabel: 'Book Now', ctaStyle: 'ON_DARK' as const, ctaActionType: 'EXPLORE' as const,
    ctaParams: {}, startsAt: '', expiresAt: '',
  }
  it('accepts a minimal valid banner', () => expect(validateBannerForm(base)).toEqual({}))
  it('accepts an image-only banner: no headline, no text, no button', () => {
    expect(validateBannerForm({ ...base, title: '', ctaEnabled: false })).toEqual({})
    expect(bannerCreateSchema.parse({
      campaignName: 'Eid art', title: '', imagePosition: 'CENTER', ctaEnabled: false,
      ctaStyle: 'ON_DARK', ctaActionType: 'EXPLORE', ctaParams: {},
    }).title).toBe('')
  })
  it('needs a destination parameter and an https link', () => {
    expect(validateBannerForm({ ...base, ctaActionType: 'CATEGORY' }).ctaParams).toBeDefined()
    expect(validateBannerForm({ ...base, ctaActionType: 'EXTERNAL_URL', ctaParams: { url: 'http://x.pk' } }).ctaParams).toMatch(/https/)
  })
  it('needs a destination when the button is shown, and an end after the start', () => {
    expect(validateBannerForm({ ...base, ctaActionType: 'NONE' }).ctaActionType).toBeDefined()
    expect(validateBannerForm({ ...base, ctaLabel: '' }).ctaLabel).toBeDefined()
    expect(validateBannerForm({ ...base, startsAt: '2026-12-02T10:00', expiresAt: '2026-12-01T10:00' }).expiresAt).toBeDefined()
    expect(validateBannerForm({ ...base, title: 'x'.repeat(81) }).title).toBeDefined()
  })
})

describe('admin API mapping', () => {
  it('create body maps to snake_case, adds the placement and clears empty strings', () => {
    const parsed = bannerCreateSchema.parse({
      campaignName: 'Eid sale', title: 'Eid offer', subtitle: '', imagePosition: 'RIGHT', ctaEnabled: false,
      ctaStyle: 'ON_DARK', ctaActionType: 'NONE', ctaParams: {}, startsAt: '2026-12-01T10:00:00+05:00', expiresAt: null,
    })
    expect(toServiceBody(parsed)).toMatchObject({
      placement: 'HOME_CAROUSEL', campaign_name: 'Eid sale', subtitle: null, cta_action_type: 'NONE',
      starts_at: '2026-12-01T10:00:00+05:00', expires_at: null,
    })
  })
  it('update requires a version and never sends a placement', () => {
    expect(() => bannerUpdateSchema.parse({ title: 'New' })).toThrow()
    const out = toServiceBody(bannerUpdateSchema.parse({ title: 'New headline', version: 4 }))
    expect(out).toEqual({ title: 'New headline', version: 4 })
  })
  it('rejects unknown fields and inverted windows', () => {
    const base = { campaignName: 'Eid sale', title: 'Eid offer', imagePosition: 'RIGHT', ctaEnabled: false, ctaStyle: 'ON_DARK', ctaActionType: 'NONE', ctaParams: {} }
    expect(() => bannerCreateSchema.parse({ ...base, status: 'PUBLISHED' })).toThrow()
    expect(() => bannerCreateSchema.parse({ ...base, startsAt: '2026-12-02T00:00:00Z', expiresAt: '2026-12-01T00:00:00Z' })).toThrow()
  })
  it('maps a service row and keeps the derived state', () => {
    const b = mapBanner({ id: ID, campaign_name: 'Eid', state: 'live', impressions: '12', clicks: 3, cta_params: null, created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-02T00:00:00Z' })
    expect(b).toMatchObject({ id: ID, campaignName: 'Eid', state: 'live', impressions: 12, clicks: 3, ctaParams: {} })
  })
})

describe('banner routes are protected', () => {
  it('lets static banner sub-routes through the id guard and blocks bad ids', () => {
    for (const s of ['media', 'reorder', 'placements/HOME_CAROUSEL', 'targets']) {
      expect(hasInvalidIdSegment(`/api/admin/banners/${s}`)).toBe(false)
    }
    expect(hasInvalidIdSegment(`/api/admin/banners/${ID}/actions/publish`)).toBe(false)
    expect(hasInvalidIdSegment('/api/admin/banners/1;drop')).toBe(true)
  })
  it('limits management to SUPER_ADMIN and OPS', () => {
    expect(permissionForPath('/marketing/banners/new')).toBe('banners:view')
    expect(hasPermission('SUPPORT', 'banners:view')).toBe(true)
    for (const p of ['banners:manage', 'banners:publish', 'banners:delete']) {
      expect(hasPermission('OPS', p)).toBe(true)
      expect(hasPermission('SUPPORT', p)).toBe(false)
      expect(hasPermission('FINANCE', p)).toBe(false)
    }
  })
})
