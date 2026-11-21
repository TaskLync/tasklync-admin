// lib/banners-api.ts (server only)
/* eslint-disable @typescript-eslint/no-explicit-any -- maps untyped snake_case rows returned by booking-service */
import { z } from 'zod'
import { BANNER_PLACEMENT, CTA_ACTIONS, CTA_STYLES, IMAGE_POSITIONS, LIMITS, type BannerState } from '@/lib/banner-constants'
import type { BannerItem, BannerPlacementSettings, BannerStats } from '@/types/banner'

const opt = (max: number) => z.string().trim().max(max).nullable().optional()
const when = z.string().datetime({ offset: true }).nullable().optional()

const fields = {
  campaignName: z.string().trim().min(3).max(LIMITS.campaignName),
  internalNotes: opt(LIMITS.internalNotes),
  title: z.string().trim().min(3).max(LIMITS.title),
  subtitle: opt(LIMITS.subtitle),
  badgeText: opt(LIMITS.badgeText),
  offerText: opt(LIMITS.offerText),
  imageUrl: z.string().url().max(1000).nullable().optional(),
  imagePublicId: z.string().max(255).nullable().optional(),
  imageWidth: z.number().int().positive().nullable().optional(),
  imageHeight: z.number().int().positive().nullable().optional(),
  imagePosition: z.enum(IMAGE_POSITIONS),
  ctaEnabled: z.boolean(),
  ctaLabel: opt(LIMITS.ctaLabel),
  ctaStyle: z.enum(CTA_STYLES),
  ctaActionType: z.enum(CTA_ACTIONS),
  ctaParams: z.record(z.string(), z.string().max(500)),
  // Shape and limits are checked by booking-service (the authority); here only size and type.
  designConfig: z.record(z.string(), z.unknown()).nullable().optional()
    .refine((d) => !d || JSON.stringify(d).length <= 8000, 'Design settings are too large'),
  startsAt: when,
  expiresAt: when,
}

const windowRule = (v: { startsAt?: string | null; expiresAt?: string | null }, ctx: z.RefinementCtx) => {
  if (v.startsAt && v.expiresAt && new Date(v.expiresAt) <= new Date(v.startsAt)) {
    ctx.addIssue({ code: 'custom', path: ['expiresAt'], message: 'The end must be after the start' })
  }
}

export const bannerCreateSchema = z.object(fields).strict().superRefine(windowRule)
export const bannerUpdateSchema = z
  .object({ ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.optional()])), version: z.number().int().positive() })
  .strict()
  .superRefine(windowRule as never) as unknown as z.ZodType<Record<string, unknown> & { version: number }>
export const versionSchema = z.object({ version: z.number().int().positive() }).strict()
export const statusSchema = z.object({ version: z.number().int().positive(), isEnabled: z.boolean() }).strict()
export const reorderSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(200) }).strict()
export const placementSchema = z.object({
  autoSlideEnabled: z.boolean(),
  autoSlideIntervalMs: z.number().int().min(2000).max(15000),
  maxBanners: z.number().int().min(1).max(10),
}).strict()

const SNAKE: Record<string, string> = {
  campaignName: 'campaign_name', internalNotes: 'internal_notes', title: 'title', subtitle: 'subtitle',
  badgeText: 'badge_text', offerText: 'offer_text', imageUrl: 'image_url', imagePublicId: 'image_public_id',
  imageWidth: 'image_width', imageHeight: 'image_height', imagePosition: 'image_position', ctaEnabled: 'cta_enabled',
  ctaLabel: 'cta_label', ctaStyle: 'cta_style', ctaActionType: 'cta_action_type', ctaParams: 'cta_params', designConfig: 'design_config',
  startsAt: 'starts_at', expiresAt: 'expires_at', version: 'version',
}

/** camelCase admin input -> booking-service body. Empty strings become null so a field can be cleared. */
export function toServiceBody(b: Record<string, unknown>, placement = BANNER_PLACEMENT) {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(b)) {
    if (v === undefined || !SNAKE[k]) continue
    out[SNAKE[k]] = v === '' ? null : v
  }
  if (!('version' in b)) out.placement = placement
  return out
}

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null)

export function mapBanner(r: any): BannerItem {
  return {
    id: r.id, placement: r.placement, campaignName: r.campaign_name, internalNotes: r.internal_notes,
    title: r.title, subtitle: r.subtitle, badgeText: r.badge_text, offerText: r.offer_text,
    imageUrl: r.image_url, imagePublicId: r.image_public_id, imageWidth: r.image_width, imageHeight: r.image_height,
    imagePosition: r.image_position, ctaEnabled: r.cta_enabled, ctaLabel: r.cta_label, ctaStyle: r.cta_style,
    ctaActionType: r.cta_action_type, ctaParams: r.cta_params ?? {}, designConfig: r.design_config ?? null, status: r.status, isEnabled: r.is_enabled,
    state: r.state as BannerState, displayOrder: r.display_order, startsAt: iso(r.starts_at), expiresAt: iso(r.expires_at),
    publishedAt: iso(r.published_at), version: r.version, createdByEmail: r.created_by_email,
    updatedByEmail: r.updated_by_email, createdAt: iso(r.created_at)!, updatedAt: iso(r.updated_at)!,
    impressions: Number(r.impressions ?? 0), clicks: Number(r.clicks ?? 0),
  }
}

export function mapStats(s: any): BannerStats {
  return {
    impressions: Number(s?.impressions ?? 0), clicks: Number(s?.clicks ?? 0), ctaClicks: Number(s?.cta_clicks ?? 0),
    uniqueUsers: Number(s?.unique_users ?? 0), ctr: Number(s?.ctr ?? 0),
    daily: (s?.daily ?? []).map((d: any) => ({ day: d.day, impressions: Number(d.impressions), clicks: Number(d.clicks) })),
  }
}

export function mapPlacement(p: any): BannerPlacementSettings {
  return {
    code: p.code, label: p.label, autoSlideEnabled: p.auto_slide_enabled, autoSlideIntervalMs: p.auto_slide_interval_ms,
    maxBanners: p.max_banners, updatedByEmail: p.updated_by_email, updatedAt: iso(p.updated_at)!,
  }
}

/** What goes in the audit log: the customer-visible content, not the whole row. */
export function auditSnapshot(b: BannerItem) {
  return {
    campaignName: b.campaignName, title: b.title, offerText: b.offerText, imageUrl: b.imageUrl,
    cta: b.ctaEnabled ? { label: b.ctaLabel, action: b.ctaActionType, params: b.ctaParams } : null,
    startsAt: b.startsAt, expiresAt: b.expiresAt, state: b.state, version: b.version,
  }
}
