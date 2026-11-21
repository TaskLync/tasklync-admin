// lib/fonts-api.ts (server only): banner font library request schemas + booking-service row mapping.
/* eslint-disable @typescript-eslint/no-explicit-any -- maps untyped snake_case rows returned by booking-service */
import { z } from 'zod'
import type { FontFamily, FontFamilyDetail, FontVariant } from '@/types/font'
import { FONT_WEIGHTS } from '@/lib/banner-design'

export const FONT_RULES = {
  maxMb: 2,
  extensions: ['.ttf', '.otf'],
} as const

const name = z.string().trim().min(2, 'At least 2 characters').max(60, 'At most 60 characters')
const description = z.string().trim().max(200).nullable().optional()

export const fontCreateSchema = z.object({ name, description }).strict()
export const fontUpdateSchema = z.object({ version: z.number().int().positive(), name: name.optional(), description }).strict()
export const fontStatusSchema = z.object({ version: z.number().int().positive(), isActive: z.boolean() }).strict()
export const fontVariantSchema = z.object({
  weight: z.coerce.number().int().refine((w) => (FONT_WEIGHTS as readonly number[]).includes(w), 'Weight must be 100–900'),
  style: z.enum(['normal', 'italic']).default('normal'),
})

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null)

export function mapVariant(v: any): FontVariant {
  return {
    id: v.id, weight: Number(v.weight), style: v.style, format: v.format ?? null, fileUrl: v.file_url ?? null,
    fileBytes: v.file_bytes ?? null, originalFilename: v.original_filename ?? null, appFontName: v.app_font_name ?? null,
    createdAt: iso(v.created_at)!,
  }
}

export function mapFont(r: any): FontFamily {
  return {
    id: r.id, name: r.name, description: r.description ?? null, source: r.source, isActive: r.is_active, version: r.version,
    createdByEmail: r.created_by_email ?? null, updatedByEmail: r.updated_by_email ?? null,
    createdAt: iso(r.created_at)!, updatedAt: iso(r.updated_at)!,
    usedBy: Number(r.used_by ?? 0), usedByPublished: Number(r.used_by_published ?? 0),
    variants: (r.variants ?? []).map(mapVariant),
  }
}

export function mapFontDetail(r: any): FontFamilyDetail {
  return {
    ...mapFont(r),
    usage: (r.usage ?? []).map((u: any) => ({ id: u.id, campaignName: u.campaign_name, status: u.status })),
  }
}
