import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { fetcher } from '@/lib/swr-fetcher'
import { loadCustomFace, type FaceStatus } from '@/lib/font-loader'
import type { DesignFontFamily } from '@/lib/banner-design'
import type { FontFamily, FontFamilyDetail } from '@/types/font'

/** The whole library (Font Library page) or only active families (banner editor pickers). */
export function useFontLibrary(activeOnly = false) {
  const { data, error, isLoading, mutate } = useSWR<{ data: FontFamily[] }>(
    `/api/admin/fonts${activeOnly ? '?active=true' : ''}`, fetcher, { keepPreviousData: true })
  return { fonts: data?.data ?? [], error, isLoading, mutate }
}

export function useFontDetail(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ data: FontFamilyDetail }>(id ? `/api/admin/fonts/${id}` : null, fetcher)
  return { font: data?.data, error, isLoading, mutate }
}

/** Library rows -> the shape the design resolver uses (same as the customer feed's fonts). */
export function toDesignFonts(fonts: FontFamily[]): DesignFontFamily[] {
  return fonts.map((f) => ({
    id: f.id, name: f.name, source: f.source,
    variants: f.variants.map((v) => ({ id: v.id, weight: v.weight, style: v.style, format: v.format, url: v.fileUrl, appFontName: v.appFontName })),
  }))
}

/**
 * Loads the given uploaded faces and re-renders as each settles. Returns the status per variant id,
 * so a renderer can show a face only once it is really available (like the app does).
 */
export function useCustomFaces(faces: { variantId: string; url: string; format: 'ttf' | 'otf' }[]) {
  const key = faces.map((f) => f.variantId).sort().join(',')
  const [state, setState] = useState<Record<string, FaceStatus>>({})
  useEffect(() => {
    // A face with no entry yet is still loading; renderers treat anything but 'loaded' as "use the fallback".
    let alive = true
    for (const f of faces) {
      loadCustomFace(f.variantId, f.url, f.format).then((st) => {
        if (alive) setState((s) => ({ ...s, [f.variantId]: st }))
      })
    }
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the variant ids
  }, [key])
  return useMemo(() => state, [state])
}

async function send<T>(url: string, method: string, body?: object): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(json.error || 'Action failed'), { status: res.status, code: json.code })
  return json as T
}

export const fontActions = {
  create: (input: { name: string; description?: string | null }) => send<{ data: FontFamily }>('/api/admin/fonts', 'POST', input),
  update: (id: string, input: { version: number; name?: string; description?: string | null }) =>
    send<{ data: FontFamilyDetail }>(`/api/admin/fonts/${id}`, 'PATCH', input),
  setActive: (id: string, version: number, isActive: boolean) =>
    send<{ data: FontFamilyDetail }>(`/api/admin/fonts/${id}/status`, 'PATCH', { version, isActive }),
  remove: (id: string) => send<{ data: { id: string } }>(`/api/admin/fonts/${id}`, 'DELETE'),
  removeVariant: (id: string, variantId: string) =>
    send<{ data: FontFamilyDetail }>(`/api/admin/fonts/${id}/variants/${variantId}`, 'DELETE'),
  uploadVariant: async (id: string, file: File, weight: number, style: 'normal' | 'italic') => {
    const form = new FormData()
    form.append('weight', String(weight))
    form.append('style', style)
    form.append('file', file)
    const res = await fetch(`/api/admin/fonts/${id}/variants`, { method: 'POST', body: form })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error || 'Upload failed')
    return json as { data: FontFamilyDetail }
  },
}
