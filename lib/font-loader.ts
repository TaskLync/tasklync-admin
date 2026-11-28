// lib/font-loader.ts  (client only): registers uploaded banner faces in the browser with the FontFace API,
// under the same name the customer app registers them (customFaceName), once per page.
import { customFaceName } from '@/lib/banner-design'

export type FaceStatus = 'loading' | 'loaded' | 'failed'

const loads = new Map<string, Promise<FaceStatus>>()
const status = new Map<string, FaceStatus>()

export function faceStatus(variantId: string): FaceStatus | undefined {
  return status.get(variantId)
}

/** Loads one uploaded face. Never rejects: a failure resolves 'failed' and the renderer keeps its fallback. */
export function loadCustomFace(variantId: string, url: string, format: 'ttf' | 'otf'): Promise<FaceStatus> {
  const existing = loads.get(variantId)
  if (existing) return existing
  if (typeof window === 'undefined' || typeof FontFace === 'undefined') return Promise.resolve('failed')
  status.set(variantId, 'loading')
  const p = (async (): Promise<FaceStatus> => {
    try {
      const face = new FontFace(customFaceName(variantId), `url("${encodeURI(url)}") format("${format === 'otf' ? 'opentype' : 'truetype'}")`)
      await face.load()
      document.fonts.add(face)
      status.set(variantId, 'loaded')
      return 'loaded'
    } catch {
      status.set(variantId, 'failed')
      loads.delete(variantId) // allow a retry on the next render
      return 'failed'
    }
  })()
  loads.set(variantId, p)
  return p
}
