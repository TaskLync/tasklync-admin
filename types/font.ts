import type { FontStyle } from '@/lib/banner-design'

export interface FontVariant {
  id: string
  weight: number
  style: FontStyle
  format: 'ttf' | 'otf' | null
  fileUrl: string | null
  fileBytes: number | null
  originalFilename: string | null
  appFontName: string | null
  createdAt: string
}

export interface FontFamily {
  id: string
  name: string
  description: string | null
  source: 'BUNDLED' | 'CUSTOM'
  isActive: boolean
  version: number
  createdByEmail: string | null
  updatedByEmail: string | null
  createdAt: string
  updatedAt: string
  usedBy: number
  usedByPublished: number
  variants: FontVariant[]
}

export interface FontFamilyDetail extends FontFamily {
  usage: { id: string; campaignName: string; status: string }[]
}
