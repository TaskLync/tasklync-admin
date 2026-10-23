// lib/auth/redirect.ts  (pure, safe on client + edge)
/** Only allow same-site relative paths. Blocks open redirects like //evil.com or /\evil.com */
export function safeNextPath(value: string | null | undefined, fallback = '/'): string {
  if (!value) return fallback
  if (/[\r\n]/.test(value)) return fallback
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback
  if (value.startsWith('/auth') || value.startsWith('/api/')) return fallback
  return value
}