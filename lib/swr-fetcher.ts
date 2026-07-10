// lib/swr-fetcher.ts
export const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Request failed')
  }
  return res.json()
}