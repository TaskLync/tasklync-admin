import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { permissionForPath, hasPermission } from '@/lib/auth/rbac'
import type { AdminRole } from '@/types/auth'

const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!)

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isAuthRoute = pathname.startsWith('/auth')
  const isAuthApi = pathname.startsWith('/api/admin/auth')

  if (isAuthRoute || isAuthApi) return NextResponse.next()

  const accessToken = request.headers.get('authorization')?.replace('Bearer ', '')
    ?? request.cookies.get('admin_access')?.value

  if (!accessToken) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  try {
    const { payload } = await jwtVerify(accessToken, secret)
    const role = payload.role as AdminRole

    const requiredPermission = permissionForPath(pathname)
    if (requiredPermission && !hasPermission(role, requiredPermission)) {
      return NextResponse.redirect(new URL('/', request.url)) // bounce to dashboard, not an error page
    }

    return NextResponse.next()
  } catch {
    // Invalid, tampered, or expired token — never let the request through.
    // Client-side useAdminSession handles silent refresh for API calls;
    // a plain page navigation with a dead token must go straight to login.
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}