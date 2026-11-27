'use client'

import { Poppins, Plus_Jakarta_Sans } from 'next/font/google'
import { ArrowRight, ImageIcon } from 'lucide-react'
import { splitHeadline, type CtaStyle, type ImagePosition } from '@/lib/banner-constants'

// Same faces as the customer app (src/design/typography.ts), scoped to the preview only.
const poppins = Poppins({ subsets: ['latin'], weight: ['600', '700'], display: 'swap' })
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['500'], display: 'swap' })

/**
 * Pixel replica of the customer app banner (src/components/home/PromoBannerSlide.tsx,
 * src/utils/bannerLayout.ts and src/utils/bannerContent.ts):
 *   - 2.4:1 card (height clamped 112–220 px), 20 px radius, no border, no shadow;
 *   - IMAGE ONLY (no copy, no button): the artwork alone, edge to edge, nothing on top;
 *   - WITH COPY: copy directly on the artwork (no overlay, no fade), badge / headline / offer / subtitle column (62% of the
 *     width, max 240 px) and the pill button. Content that cannot fit is dropped like the app does:
 *     subtitle first, then the second headline line, then the badge.
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

const RATIO = 2.4
const RADIUS = 20
/** Readability without an overlay (same as the app): a soft shadow behind the glyphs only. */
const LEGIBLE = '0 1px 6px rgba(0,0,0,0.45)'
const POSITION: Record<ImagePosition, string> = { LEFT: 'left center', CENTER: 'center center', RIGHT: 'right center' }
const OFFER = '#4ADE80'

// Built-in element sizes (customer app utils/bannerDesign.ts LEGACY).
const PAD_V = 14 * 2
const BADGE_H = 12 + 4 + 5
const HEADLINE_LH = 21
const OFFER_H = Math.round(HEADLINE_LH * 0.82) + 2
const SUBTITLE_H = 15 + 4
const CTA_H = 36 + 8

export default function BannerPreview({
  width = 328, title, subtitle, badgeText, offerText, imageUrl, imagePosition = 'RIGHT', cta,
}: BannerPreviewProps) {
  const height = Math.min(220, Math.max(112, Math.round(width / RATIO)))
  const textMax = Math.min(Math.round(width * 0.62), 240)
  const t = title.trim()
  const offer = (offerText ?? '').trim()
  const h = splitHeadline(t, offer)
  const hasContent = Boolean(t || subtitle?.trim() || badgeText?.trim() || offer || cta)

  // Same drop order as the app (utils/bannerContent.ts).
  const fit = {
    badge: Boolean(badgeText?.trim()),
    lines: t ? 2 : 0,
    offerLine: Boolean(offer) && !h.inline,
    subtitle: Boolean(subtitle?.trim()),
  }
  const need = () =>
    (fit.badge ? BADGE_H : 0) + fit.lines * HEADLINE_LH + (fit.offerLine ? OFFER_H : 0) +
    (fit.subtitle ? SUBTITLE_H : 0) + (cta ? CTA_H : 0)
  const avail = height - PAD_V
  if (need() > avail) fit.subtitle = false
  while (need() > avail && fit.lines > 1) fit.lines -= 1
  if (need() > avail) fit.badge = false
  if (need() > avail && t) fit.offerLine = false

  return (
    <div className="relative overflow-hidden" style={{ width, height, borderRadius: RADIUS, background: imageUrl ? 'transparent' : '#E5E7EB' }}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: POSITION[imagePosition] }} />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-gray-400">
          <ImageIcon size={26} />
          <span className="text-[11px]">1200 x 500 px image</span>
        </div>
      )}

      {hasContent ? (
        <>
          <div
            className="absolute inset-0 flex flex-col items-start"
            style={{ padding: '14px 18px', justifyContent: cta ? 'space-between' : 'center' }}
          >
            <div style={{ maxWidth: textMax }}>
              {fit.badge ? (
                <span
                  className={poppins.className}
                  style={{
                    display: 'inline-block', marginBottom: 5, padding: '2px 7px', borderRadius: 6,
                    background: 'rgba(74,222,128,0.16)',                     color: OFFER, fontSize: 9, lineHeight: '12px', fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase',
                  }}
                >
                  {badgeText}
                </span>
              ) : null}
              {t ? (
                <p
                  className={poppins.className}
                  style={{
                    color: '#FFFFFF', textShadow: LEGIBLE, fontSize: 16, lineHeight: `${HEADLINE_LH}px`, fontWeight: 700, letterSpacing: -0.2,
                    display: '-webkit-box', WebkitLineClamp: fit.lines, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}
                >
                  {h.before}
                  {h.inline ? <span style={{ color: OFFER }}>{h.highlight}</span> : null}
                  {h.after}
                </p>
              ) : null}
              {fit.offerLine ? (
                <p className={poppins.className} style={{ color: OFFER, textShadow: LEGIBLE, fontSize: 13, lineHeight: '17px', fontWeight: 700, marginTop: 2 }}>
                  {offer}
                </p>
              ) : null}
              {fit.subtitle ? (
                <p
                  className={`${jakarta.className} truncate`}
                  style={{ color: 'rgba(255,255,255,0.88)', textShadow: LEGIBLE, fontSize: 11.5, lineHeight: '15px', fontWeight: 500, marginTop: 4 }}
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
                  boxShadow: '0 3px 8px rgba(0,0,0,0.18)',
                  fontSize: 13, lineHeight: '18px', fontWeight: 600, letterSpacing: 0.1, whiteSpace: 'nowrap',
                }}
              >
                {cta.label || 'Button'}
                <ArrowRight size={14} strokeWidth={2.4} style={{ marginLeft: 6 }} />
              </span>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  )
}
