import { NextResponse } from 'next/server'

export function setAuthCookies(res: NextResponse, accessToken: string, refreshToken: string) {
  res.cookies.set('admin_access', accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: Number(process.env.ADMIN_ACCESS_TOKEN_TTL ?? 900), // seconds, match access token TTL
  })
  res.cookies.set('admin_session', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: Number(process.env.ADMIN_REFRESH_TOKEN_TTL ?? 28800), // seconds
  })
}