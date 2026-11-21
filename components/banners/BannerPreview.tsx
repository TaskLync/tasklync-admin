'use client'

import { useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react'
import { ArrowRight, ImageIcon } from 'lucide-react'
import { splitHeadline, type CtaStyle, type ImagePosition } from '@/lib/banner-constants'
import {
  LEGACY_COLORS, resolveBannerDesign, type BannerDesign, type DesignFontFamily, type Len, type ResolvedFont, type ResolvedText,
} from '@/lib/banner-design'
import { useCustomFaces } from '@/hooks/useFontLibrary'
import './app-fonts.css'

/**
 * Pixel replica of the customer app banner (src/components/home/PromoBannerSlide.tsx + BookNowButton.tsx):
 * 156 px tall, 16 px radius, left scrim, badge / headline / subtitle column and the CTA pill.
 * Styles come from resolveBannerDesign(), the twin of the app's resolver, using the app's own font files
 * and face names, so what the admin sees is what the phone draws.
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
  design?: BannerDesign | null
  fonts?: DesignFontFamily[]
  /** Called with true when content does not fit the banner (it would be clipped on the phone). */
  onOverflow?: (overflowing: boolean) => void
}

const SCRIM =
  'linear-gradient(90deg, rgba(6,20,14,0.94) 0%, rgba(6,20,14,0.82) 42%, rgba(6,20,14,0.45) 64%, rgba(6,20,14,0) 82%)'
const POSITION: Record<ImagePosition, string> = { LEFT: 'left center', CENTER: 'center center', RIGHT: 'right center' }

const css = (v: Len) => (typeof v === 'number' ? `${v}px` : v)
const box = (b: ResolvedText['margin']) => `${css(b.top)} ${css(b.right)} ${css(b.bottom)} ${css(b.left)}`

/** Same rule as the app: an uploaded face is used only once it has loaded; until then the fallback. */
function family(f: ResolvedFont, loaded: Record<string, string>) {
  return f.custom && loaded[f.custom.variantId] !== 'loaded' ? f.fallbackFace : f.face
}

function textCss(t: ResolvedText, loaded: Record<string, string>, color: string): CSSProperties {
  return {
    fontFamily: `'${family(t.font, loaded)}'`,
    fontWeight: 'normal',
    fontStyle: t.font.synthItalic ? 'italic' : 'normal',
    fontSize: t.fontSize,
    lineHeight: `${t.lineHeight}px`,
    letterSpacing: t.letterSpacing,
    textTransform: t.textTransform === 'none' ? undefined : t.textTransform,
    color: t.color ?? color,
    textAlign: t.textAlign,
    margin: box(t.margin),
    padding: box(t.padding),
    maxWidth: t.maxWidth !== undefined ? css(t.maxWidth) : undefined,
    alignSelf: t.textAlign && t.textAlign !== 'left' ? 'stretch' : undefined,
  }
}

const clamp = (lines: number | undefined): CSSProperties =>
  !lines ? {} : lines === 1
    ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
    : { display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }

export default function BannerPreview({
  width = 328, title, subtitle, badgeText, offerText, imageUrl, imagePosition = 'RIGHT', cta, design, fonts = [], onOverflow,
}: BannerPreviewProps) {
  const r = useMemo(() => resolveBannerDesign(design, fonts, width), [design, fonts, width])
  const loaded = useCustomFaces(r.customFonts)
  const h = splitHeadline(title || 'Your headline', offerText)

  const layerRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!onOverflow) return
    const check = () => {
      const layer = layerRef.current
      const block = textRef.current
      const over = !!layer && (layer.scrollHeight > layer.clientHeight + 1 || layer.scrollWidth > layer.clientWidth + 1)
      const clipped = !!block && block.scrollHeight > block.clientHeight + 1
      onOverflow(over || clipped)
    }
    check()
    // Fonts swap in asynchronously and change the metrics.
    const t = setTimeout(check, 300)
    return () => clearTimeout(t)
  })

  const ctaBg = r.cta.backgroundColor ?? (cta?.style === 'BRAND' ? LEGACY_COLORS.ctaBrandBackground : LEGACY_COLORS.ctaOnDarkBackground)
  const ctaInk = r.cta.color ?? (cta?.style === 'BRAND' ? LEGACY_COLORS.ctaBrand : LEGACY_COLORS.ctaOnDark)

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

      <div
        ref={layerRef}
        className="absolute inset-0 flex flex-col items-start overflow-hidden"
        style={{ padding: box(r.layout.padding), justifyContent: r.layout.justify }}
      >
        <div
          ref={textRef}
          className="flex min-h-0 flex-col items-start overflow-hidden"
          style={{ maxWidth: css(r.layout.textMaxWidth), flexShrink: 1, alignSelf: r.layout.stretchText ? 'stretch' : undefined }}
        >
          {badgeText ? (
            <span
              style={{
                ...textCss(r.badge, loaded, LEGACY_COLORS.badge),
                alignSelf: r.badge.alignSelf,
                maxWidth: '100%',
                background: r.badge.backgroundColor ?? 'rgba(74,222,128,0.16)',
                border: r.badge.backgroundColor ? undefined : '1px solid rgba(74,222,128,0.32)',
                borderRadius: r.badge.borderRadius,
                ...clamp(1),
              }}
            >
              {badgeText}
            </span>
          ) : null}
          <p style={{ ...textCss(r.headline, loaded, LEGACY_COLORS.headline), ...clamp(r.headline.maxLines) }}>
            {h.before}
            {h.inline ? <span style={{ color: '#4ADE80' }}>{h.highlight}</span> : null}
            {h.after}
          </p>
          {!h.inline && offerText ? (
            <p style={{ fontFamily: "'Poppins-Bold'", color: '#4ADE80', fontSize: 13, lineHeight: '17px', marginTop: 2, ...clamp(1) }}>
              {offerText}
            </p>
          ) : null}
          {subtitle ? (
            <p style={{ ...textCss(r.subtitle, loaded, LEGACY_COLORS.subtitle), ...clamp(r.subtitle.maxLines) }}>{subtitle}</p>
          ) : null}
        </div>

        {cta ? (
          <span
            className="inline-flex shrink-0 items-center"
            style={{
              height: r.cta.height,
              width: r.cta.width !== undefined ? css(r.cta.width) : undefined,
              minWidth: r.cta.minWidth,
              maxWidth: '100%',
              padding: box(r.cta.padding),
              margin: box(r.cta.margin),
              borderRadius: r.cta.borderRadius,
              justifyContent: r.cta.justifyContent,
              alignSelf: r.cta.alignSelf,
              background: ctaBg,
              boxSizing: 'border-box',
            }}
          >
            <span
              style={{
                ...textCss({ ...r.cta, margin: { top: 0, right: 0, bottom: 0, left: 0 }, padding: { top: 0, right: 0, bottom: 0, left: 0 }, textAlign: undefined }, loaded, ctaInk),
                ...clamp(1),
              }}
            >
              {cta.label || 'Button'}
            </span>
            <ArrowRight size={14} strokeWidth={2.2} color={ctaInk} style={{ marginLeft: 6, flexShrink: 0 }} />
          </span>
        ) : null}
      </div>
    </div>
  )
}
