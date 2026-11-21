import type { BannerState, CtaAction, CtaStyle, ImagePosition } from '@/lib/banner-constants'

export interface BannerItem {
  id: string
  placement: string
  campaignName: string
  internalNotes: string | null
  title: string
  subtitle: string | null
  badgeText: string | null
  offerText: string | null
  imageUrl: string | null
  imagePublicId: string | null
  imageWidth: number | null
  imageHeight: number | null
  imagePosition: ImagePosition
  ctaEnabled: boolean
  ctaLabel: string | null
  ctaStyle: CtaStyle
  ctaActionType: CtaAction
  ctaParams: Record<string, string>
  status: 'DRAFT' | 'PUBLISHED'
  isEnabled: boolean
  state: BannerState
  displayOrder: number
  startsAt: string | null
  expiresAt: string | null
  publishedAt: string | null
  version: number
  createdByEmail: string
  updatedByEmail: string | null
  createdAt: string
  updatedAt: string
  impressions: number
  clicks: number
}

export interface BannerStats {
  impressions: number
  clicks: number
  ctaClicks: number
  uniqueUsers: number
  ctr: number
  daily: { day: string; impressions: number; clicks: number }[]
}

export interface BannerDetail extends BannerItem {
  stats: BannerStats
}

export interface BannerList {
  data: BannerItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface BannerPlacementSettings {
  code: string
  label: string
  autoSlideEnabled: boolean
  autoSlideIntervalMs: number
  maxBanners: number
  updatedByEmail: string | null
  updatedAt: string
}

export interface BannerTarget {
  id: string
  label: string
  sub: string | null
}

/** What the editor form holds. Dates are PKT wall-clock strings ("YYYY-MM-DDTHH:mm"). */
export interface BannerFormValues {
  campaignName: string
  internalNotes: string
  title: string
  subtitle: string
  badgeText: string
  offerText: string
  imageUrl: string | null
  imagePublicId: string | null
  imageWidth: number | null
  imageHeight: number | null
  imagePosition: ImagePosition
  ctaEnabled: boolean
  ctaLabel: string
  ctaStyle: CtaStyle
  ctaActionType: CtaAction
  ctaParams: Record<string, string>
  startsAt: string
  expiresAt: string
}
