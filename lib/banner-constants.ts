// lib/banner-constants.ts  (client + server safe)
// Rules mirror booking-service (validators/banner.validators.ts), which is the authority.

export const BANNER_PLACEMENT = 'HOME_CAROUSEL' as const

export const BANNER_STATES = ['draft', 'scheduled', 'live', 'paused', 'expired'] as const
export type BannerState = (typeof BANNER_STATES)[number]

export const STATE_LABEL: Record<BannerState, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  live: 'Live',
  paused: 'Paused',
  expired: 'Expired',
}

export const STATE_HINT: Record<BannerState, string> = {
  draft: 'Not visible. Publish to schedule it.',
  scheduled: 'Published. Appears at the start time.',
  live: 'Visible in the customer app now.',
  paused: 'Published but switched off.',
  expired: 'The end date has passed.',
}

export const CTA_STYLES = ['ON_DARK', 'BRAND'] as const
export type CtaStyle = (typeof CTA_STYLES)[number]
export const CTA_STYLE_LABEL: Record<CtaStyle, string> = {
  ON_DARK: 'White pill (default)',
  BRAND: 'Brand green',
}

export const IMAGE_POSITIONS = ['LEFT', 'CENTER', 'RIGHT'] as const
export type ImagePosition = (typeof IMAGE_POSITIONS)[number]

export type CtaParamKind = 'category' | 'worker' | 'company' | 'url'

export const CTA_ACTIONS = [
  'NONE', 'HOME', 'EXPLORE', 'CATEGORIES', 'CATEGORY', 'WORKER', 'COMPANY', 'COMPANIES', 'CUSTOM_REQUEST', 'EXTERNAL_URL',
] as const
export type CtaAction = (typeof CTA_ACTIONS)[number]

/** Offered in the editor. Tasklync is app-first: every banner opens an in-app screen, so web links
 *  (EXTERNAL_URL) are not offered. booking-service also rejects them unless BANNER_EXTERNAL_URL_HOSTS is set. */
export const SELECTABLE_CTA_ACTIONS = CTA_ACTIONS.filter((a) => a !== 'EXTERNAL_URL')

export const CTA_ACTION_META: Record<CtaAction, { label: string; hint: string; param?: { key: string; kind: CtaParamKind } }> = {
  NONE: { label: 'No destination', hint: 'The banner is informational. No button, no tap action.' },
  HOME: { label: 'Home screen', hint: 'Opens the customer home tab.' },
  EXPLORE: { label: 'Explore services', hint: 'Opens the Explore tab (search and all services).' },
  CATEGORIES: { label: 'All categories', hint: 'Opens the full category list.' },
  CATEGORY: { label: 'A service category', hint: 'Opens one category and its services: the start of a booking.', param: { key: 'category_id', kind: 'category' } },
  WORKER: { label: 'A worker profile', hint: 'Opens a verified worker. Customers book from there.', param: { key: 'worker_id', kind: 'worker' } },
  COMPANY: { label: 'An agency profile', hint: 'Opens a verified agency (company provider).', param: { key: 'worker_id', kind: 'company' } },
  COMPANIES: { label: 'All agencies', hint: 'Opens the agencies list.' },
  CUSTOM_REQUEST: { label: 'Post a custom request', hint: 'Opens the custom job request form.' },
  EXTERNAL_URL: { label: 'Web page (https)', hint: 'Opens in the in-app browser. Only approved Tasklync domains are accepted.', param: { key: 'url', kind: 'url' } },
}

export const LIMITS = {
  campaignName: 120,
  internalNotes: 1000,
  title: 80,
  subtitle: 90,
  badgeText: 24,
  offerText: 32,
  ctaLabel: 24,
} as const

export const IMAGE_RULES = {
  maxMb: 3,
  minWidth: 800,
  types: ['image/jpeg', 'image/png', 'image/webp'],
  recommended: '1200 x 500 px (2.4:1)',
  minRatio: 1.5,
  maxRatio: 3.2,
} as const

export const BADGE_SUGGESTIONS = ['SPECIAL OFFER', 'LIMITED TIME', 'NEW']

// ─── Pakistan time (Asia/Karachi is UTC+5 all year, no DST) ───────────────────

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000

/** ISO instant -> "YYYY-MM-DDTHH:mm" in Karachi wall-clock time (for <input type="datetime-local">). */
export function toPktInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  return new Date(t + PKT_OFFSET_MS).toISOString().slice(0, 16)
}

/** "YYYY-MM-DDTHH:mm" read as Karachi time -> ISO string with the +05:00 offset, or null when empty. */
export function fromPktInput(local: string): string | null {
  if (!local) return null
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null
  return `${local}:00+05:00`
}

export function formatPkt(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Asia/Karachi', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/**
 * Headline split used by the preview and the app: when the offer text appears inside the headline it is
 * highlighted in place; otherwise the headline renders plain (the offer shows as its own line).
 */
export function splitHeadline(title: string, offer: string | null | undefined) {
  const o = (offer ?? '').trim()
  if (!o) return { before: title, highlight: '', after: '', inline: false }
  const at = title.toLowerCase().indexOf(o.toLowerCase())
  if (at < 0) return { before: title, highlight: '', after: '', inline: false }
  return { before: title.slice(0, at), highlight: title.slice(at, at + o.length), after: title.slice(at + o.length), inline: true }
}
