// lib/banner-form.ts  (client safe, pure): the banner editor's form model.
import { CTA_ACTION_META, LIMITS, fromPktInput, toPktInput } from '@/lib/banner-constants'
import type { BannerDetail, BannerFormValues } from '@/types/banner'

export const EMPTY_BANNER_FORM: BannerFormValues = {
  campaignName: '', internalNotes: '', title: '', subtitle: '', badgeText: '', offerText: '',
  imageUrl: null, imagePublicId: null, imageWidth: null, imageHeight: null, imagePosition: 'RIGHT',
  ctaEnabled: false, ctaLabel: 'Book Now', ctaStyle: 'ON_DARK', ctaActionType: 'EXPLORE', ctaParams: {},
  startsAt: '', expiresAt: '',
}

export function fromBanner(b: BannerDetail): BannerFormValues {
  return {
    campaignName: b.campaignName, internalNotes: b.internalNotes ?? '', title: b.title, subtitle: b.subtitle ?? '',
    badgeText: b.badgeText ?? '', offerText: b.offerText ?? '', imageUrl: b.imageUrl, imagePublicId: b.imagePublicId,
    imageWidth: b.imageWidth, imageHeight: b.imageHeight, imagePosition: b.imagePosition, ctaEnabled: b.ctaEnabled,
    ctaLabel: b.ctaLabel ?? '', ctaStyle: b.ctaStyle, ctaActionType: b.ctaActionType, ctaParams: b.ctaParams ?? {},
    startsAt: toPktInput(b.startsAt), expiresAt: toPktInput(b.expiresAt),
  }
}

/**
 * Client-side checks so the admin sees problems before saving. booking-service re-checks everything.
 * Every piece of banner copy (badge, offer, headline, subtitle) and the button is optional: an image alone
 * is a complete banner.
 */
export function validateBannerForm(v: BannerFormValues): Record<string, string> {
  const e: Record<string, string> = {}
  if (v.campaignName.trim().length < 3) e.campaignName = 'At least 3 characters'
  for (const k of ['campaignName', 'internalNotes', 'title', 'subtitle', 'badgeText', 'offerText', 'ctaLabel'] as const) {
    if (v[k].trim().length > LIMITS[k]) e[k] = `At most ${LIMITS[k]} characters`
  }
  const meta = CTA_ACTION_META[v.ctaActionType]
  if (meta.param && !v.ctaParams[meta.param.key]?.trim()) {
    e.ctaParams = meta.param.kind === 'url' ? 'Enter the https link' : 'Choose a destination'
  }
  if (meta.param?.kind === 'url' && v.ctaParams.url && !/^https:\/\//i.test(v.ctaParams.url.trim())) {
    e.ctaParams = 'The link must start with https://'
  }
  if (v.ctaEnabled) {
    if (!v.ctaLabel.trim()) e.ctaLabel = 'Button text is required'
    if (v.ctaActionType === 'NONE') e.ctaActionType = 'Choose a destination, or hide the button'
  }
  if (v.startsAt && v.expiresAt && v.expiresAt <= v.startsAt) e.expiresAt = 'Must be after the start'
  return e
}

export function toPayload(v: BannerFormValues) {
  const meta = CTA_ACTION_META[v.ctaActionType]
  return {
    campaignName: v.campaignName.trim(), internalNotes: v.internalNotes.trim(), title: v.title.trim(),
    subtitle: v.subtitle.trim(), badgeText: v.badgeText.trim(), offerText: v.offerText.trim(),
    imageUrl: v.imageUrl, imagePublicId: v.imagePublicId, imageWidth: v.imageWidth, imageHeight: v.imageHeight,
    imagePosition: v.imagePosition, ctaEnabled: v.ctaEnabled && v.ctaActionType !== 'NONE',
    ctaLabel: v.ctaLabel.trim(), ctaStyle: v.ctaStyle, ctaActionType: v.ctaActionType,
    ctaParams: meta.param ? { [meta.param.key]: (v.ctaParams[meta.param.key] ?? '').trim() } : {},
    startsAt: fromPktInput(v.startsAt), expiresAt: fromPktInput(v.expiresAt),
  }
}
