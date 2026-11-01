// app/api/admin/users/[userId]/actions/impersonate/route.ts
// REMOVED (audit C-09). No service accepts an impersonation token, and returning a signed JWT in a URL is unsafe.
// A read-only "view as user" screen can be designed later.
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ error: 'Impersonation has been removed.' }, { status: 410 })
}