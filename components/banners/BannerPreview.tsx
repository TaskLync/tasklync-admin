'use client'

import { Poppins, Plus_Jakarta_Sans } from 'next/font/google'
import { ArrowRight, ImageIcon } from 'lucide-react'
import { splitHeadline, type CtaStyle, type ImagePosition } from '@/lib/banner-constants'

// Same faces as the customer app (src/design/typography.ts), scoped to the preview only.
const poppins = Poppins({ subsets: ['latin'], weight: ['600', '700'], display: 'swap' })
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['500'], display: 'swap' })

/**
 * Pixel replica of the customer app banner (src/components/home/BannerCarousel.tsx and
 * PromoBannerSlide.tsx): 156 px tall, 16 px radius, left scrim, badge / headline / subtitle column
 * capped at 62% of the width (max 240 px), and the BookNowButton pill.
 * `width` is the phone's content width (screen width minus 2 x 16 px margins).
 */
export interface BannerPreviewProps {
  width?: number
  title: string
  subtitle?: string | null
  badgeText?: string | null
  offerText?: string | null
  imageUrl?: string | null
  imagePosition?: ImagePosition
  cta?: { label: string; style: CtaStyle } | null
}

const SCRIM =
  'linear-gradient(90deg, rgba(6,20,14,0.94) 0%, rgba(6,20,14,0.82) 42%, rgba(6,20,14,0.45) 64%, rgba(6,20,14,0) 82%)'
const POSITION: Record<ImagePosition, string> = { LEFT: 'left center', CENTER: 'center center', RIGHT: 'right center' }

export default function BannerPreview({
  width = 328, title, subtitle, badgeText, offerText, imageUrl, imagePosition = 'RIGHT', cta,
}: BannerPreviewProps) {
  const textMax = Math.min(Math.round(width * 0.62), 240)
  const h = splitHeadline(title || 'Your headline', offerText)

  return (
    <div
      className="relative overflow-hidden"
      style={{ width, height: 156, borderRadius: 16, background: '#06140E', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: POSITION[imagePosition] }} />
      ) : (
        <div className="absolute inset-y-0 right-0 flex w-1/2 items-center justify-center text-white/30">
          <ImageIcon size={28} />
        </div>
      )}
      <div className="pointer-events-none absolute inset-0" style={{ background: SCRIM }} />

      <div className="absolute inset-0 flex flex-col items-start justify-between" style={{ padding: '14px 18px' }}>
        <div style={{ maxWidth: textMax }}>
          {badgeText ? (
            <span
              className={poppins.className}
              style={{
                display: 'inline-block', marginBottom: 5, padding: '2px 7px', borderRadius: 6,
                background: 'rgba(74,222,128,0.16)', border: '1px solid rgba(74,222,128,0.32)',
                color: '#4ADE80', fontSize: 9, lineHeight: '12px', fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase',
              }}
            >
              {badgeText}
            </span>
          ) : null}
          <p
            className={poppins.className}
            style={{
              color: '#FFFFFF', fontSize: 16, lineHeight: '21px', fontWeight: 700, letterSpacing: -0.2,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}
          >
            {h.before}
            {h.inline ? <span style={{ color: '#4ADE80' }}>{h.highlight}</span> : null}
            {h.after}
          </p>
          {!h.inline && offerText ? (
            <p className={poppins.className} style={{ color: '#4ADE80', fontSize: 13, lineHeight: '17px', fontWeight: 700, marginTop: 2 }}>
              {offerText}
            </p>
          ) : null}
          {subtitle ? (
            <p
              className={`${jakarta.className} truncate`}
              style={{ color: 'rgba(255,255,255,0.88)', fontSize: 11.5, lineHeight: '15px', fontWeight: 500, marginTop: 4 }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>

        {cta ? (
          <span
            className={`${poppins.className} inline-flex items-center`}
            style={{
              height: 36, minWidth: 92, padding: '0 16px', borderRadius: 12, justifyContent: 'center',
              background: cta.style === 'BRAND' ? '#15803D' : '#FFFFFF',
              color: cta.style === 'BRAND' ? '#FFFFFF' : '#111827',
              fontSize: 13, lineHeight: '18px', fontWeight: 600, letterSpacing: 0.1, whiteSpace: 'nowrap',
            }}
          >
            {cta.label || 'Button'}
            <ArrowRight size={14} strokeWidth={2.2} style={{ marginLeft: 6 }} />
          </span>
        ) : null}
      </div>
    </div>
  )
}
