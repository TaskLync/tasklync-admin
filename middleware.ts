import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessToken } from '@/lib/auth/jwt'
import { permissionForPath, hasPermission } from '@/lib/auth/rbac'
import { COOKIE } from '@/lib/auth/cookies'
import { safeNextPath } from '@/lib/auth/redirect'
import type { AccessTokenPayload } from '@/types/auth'

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status })
}

// CSRF defence in depth (cookies are SameSite=Lax): a browser always sends Origin on
// cross-site unsafe requests, and it must match our own host.
function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true // non-browser clients; they would still need the cookies
  try {
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const isApi = pathname.startsWith('/api/')
  const redirect = (to: string) => NextResponse.redirect(new URL(to, request.url))

  if (isApi && UNSAFE_METHODS.has(request.method) && !isSameOrigin(request)) {
    return json(403, { error: 'Forbidden' })
  }

  // Auth endpoints enforce their own rules.
  if (pathname.startsWith('/api/admin/auth')) return NextResponse.next()

  const accessToken = request.cookies.get(COOKIE.access)?.value
  const hasRefresh = Boolean(request.cookies.get(COOKIE.session)?.value)

  let payload: AccessTokenPayload | null = null
  if (accessToken) {
    try {
      payload = await verifyAccessToken(accessToken) // checks sig, alg, iss, aud, exp, type, scope
    } catch {
      payload = null
    }
  }

  // ---- /auth/* pages --------------------------------------------------------
  if (pathname.startsWith('/auth')) {
    if (payload?.scope === 'full') return redirect('/') // already signed in
    if (payload?.scope === 'mfa_setup' && pathname !== '/auth/mfa-setup') {
      return redirect('/auth/mfa-setup')
    }
    // Opening the login page with a live refresh cookie: sign straight back in.
    if (!payload && hasRefresh && pathname === '/auth/login' && !request.nextUrl.searchParams.has('reason')) {
      const next = safeNextPath(request.nextUrl.searchParams.get('next'))
      return redirect(`/api/admin/auth/refresh?next=${encodeURIComponent(next)}`)
    }
    return NextResponse.next()
  }

  // ---- protected pages + APIs ----------------------------------------------
  if (!payload) {
    // API callers get JSON so the client can refresh + retry (see lib/auth-fetch.ts).
    if (isApi) return json(401, { error: 'Unauthorized' })

    // Access cookie expired but the refresh cookie is alive: renew silently, come back here.
    if (hasRefresh) {
      return redirect(`/api/admin/auth/refresh?next=${encodeURIComponent(pathname + search)}`)
    }

    const url = new URL('/auth/login', request.url)
    if (pathname !== '/') url.searchParams.set('next', pathname + search)
    return NextResponse.redirect(url)
  }

  // Password-only session: nothing but MFA enrolment.
  if (payload.scope !== 'full') {
    return isApi
      ? json(403, { error: 'MFA setup required', code: 'MFA_SETUP_REQUIRED' })
      : redirect('/auth/mfa-setup')
  }

  const requiredPermission = permissionForPath(pathname)
  if (requiredPermission && !hasPermission(payload.role, requiredPermission)) {
    return redirect('/') // bounce to dashboard, not an error page
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}