// lib/auth-fetch.ts  (client only)
// Silent token refresh for EVERY same-origin /api/admin/* call, so none of your
// existing hooks/mutations have to change. A 401 -> refresh once -> retry once.

const LAST_KEY = 'admin_last_refresh'
const EXCLUDED = [
  '/api/admin/auth/login',
  '/api/admin/auth/refresh',
  '/api/admin/auth/logout',
  '/api/admin/auth/mfa/verify',
]

let inFlight: Promise<boolean> | null = null

function lastRefreshAt(): number {
  try {
    return Number(localStorage.getItem(LAST_KEY) ?? 0)
  } catch {
    return 0
  }
}

function markRefreshed() {
  try {
    localStorage.setItem(LAST_KEY, String(Date.now()))
  } catch {
    /* private mode etc. */
  }
}

async function callRefresh(force: boolean): Promise<boolean> {
  // Another tab (or this one) refreshed a moment ago: cookies are shared, just retry.
  if (!force && Date.now() - lastRefreshAt() < 8000) return true
  const res = await window.fetch('/api/admin/auth/refresh', { method: 'POST', credentials: 'same-origin' })
  if (res.ok) markRefreshed()
  return res.ok
}

export function refreshSession(force = false): Promise<boolean> {
  if (inFlight) return inFlight
  const run = () => callRefresh(force)
  // Web Locks serialise refreshes across tabs; fall back gracefully where unsupported.
  const p = typeof navigator !== 'undefined' && 'locks' in navigator
    ? navigator.locks.request('admin-auth-refresh', run)
    : run()
  inFlight = p.catch(() => false).finally(() => {
    inFlight = null
  })
  return inFlight
}

export function getLastRefreshAt() {
  return lastRefreshAt()
}

function redirectToLogin() {
  if (window.location.pathname.startsWith('/auth/login')) return
  window.location.assign('/auth/login?reason=expired')
}

function shouldIntercept(url: string): boolean {
  try {
    const u = new URL(url, window.location.origin)
    if (u.origin !== window.location.origin) return false
    if (!u.pathname.startsWith('/api/admin/')) return false
    return !EXCLUDED.includes(u.pathname)
  } catch {
    return false
  }
}

const FLAG = '__tasklyncAuthFetch'

export function installFetchInterceptor() {
  if (typeof window === 'undefined') return
  const w = window as unknown as Record<string, unknown>
  if (w[FLAG]) return
  w[FLAG] = true

  const originalFetch = window.fetch.bind(window)

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!shouldIntercept(url)) return originalFetch(input, init)

    const retryInput = input instanceof Request ? input.clone() : input
    const res = await originalFetch(input, init)
    if (res.status !== 401) return res

    const ok = await refreshSession()
    if (!ok) {
      redirectToLogin()
      return res
    }
    return originalFetch(retryInput, init)
  }) as typeof window.fetch
}