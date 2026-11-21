// lib/internal-client.ts  (server only)
import { NextResponse } from 'next/server'

export class ServiceError extends Error {
  status: number
  code?: string
  service?: string
  constructor(status: number, message: string, code?: string, service?: string) {
    super(message)
    this.status = status
    this.code = code
    this.service = service
  }
}

export interface ServiceTarget {
  name: string
  url?: string
  key?: string
}

interface CallOptions {
  body?: object
  /** Multipart upload instead of JSON. fetch sets the boundary header itself. */
  form?: FormData
  /** Extra headers (e.g. the acting admin on a multipart call, which has no JSON body). */
  headers?: Record<string, string>
  query?: Record<string, string | number | undefined>
  timeoutMs?: number
}

/**
 * How to authenticate to a service.
 *  - Inside the services' network (URL = the service itself): its internal key, x-internal-key.
 *  - Through the public gateway's admin side door (URL contains /internal-admin/, used by the panel on
 *    Vercel): GATEWAY_ADMIN_KEY in x-admin-internal-key. The gateway adds the internal key itself.
 * Returns null when the needed key is missing.
 */
export function serviceAuthHeaders(serviceUrl: string, internalKey: string | undefined): Record<string, string> | null {
  if (serviceUrl.includes('/internal-admin/')) {
    const adminKey = process.env.GATEWAY_ADMIN_KEY
    return adminKey ? { 'x-admin-internal-key': adminKey } : null
  }
  return internalKey ? { 'x-internal-key': internalKey } : null
}

export async function callService<T = unknown>(
  target: ServiceTarget,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  opts: CallOptions = {}
): Promise<T> {
  const auth = target.url ? serviceAuthHeaders(target.url, target.key) : null
  if (!target.url || !auth) {
    throw new ServiceError(503, `${target.name} is not configured on the admin server.`, 'NOT_CONFIGURED', target.name)
  }

  const url = new URL(target.url.replace(/\/$/, '') + path)
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v))
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15_000)

  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: {
        ...(opts.form ? {} : { 'Content-Type': 'application/json' }),
        ...opts.headers,
        ...auth,
      },
      body: opts.form ?? (opts.body ? JSON.stringify(opts.body) : undefined),
      signal: ctrl.signal,
      cache: 'no-store',
    })
  } catch {
    throw new ServiceError(503, `${target.name} is unreachable. Try again in a moment.`, 'UNREACHABLE', target.name)
  } finally {
    clearTimeout(timer)
  }

  const text = await res.text()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    /* not JSON */
  }

  if (!res.ok) {
    const message =
      json?.error?.message ??
      (typeof json?.error === 'string' ? json.error : null) ??
      json?.message ??
      `${target.name} answered HTTP ${res.status}`
    throw new ServiceError(res.status, message, json?.error?.code, target.name)
  }
  return (json?.data ?? json) as T
}

/** Maps any error from an action route to a JSON response. 5xx from a service becomes 502. */
export function serviceErrorResponse(err: unknown, tag: string) {
  if (err instanceof ServiceError) {
    // A 401/403 from a service means the panel's service key was rejected, not that the admin's
    // session expired. Passing it through as 401 would make auth-fetch refresh the session and
    // retry forever, so surface it as a 502 with a clear message instead.
    if (err.status === 401 || err.status === 403) {
      console.error(tag, err.service, err.status, 'service rejected the admin panel credentials:', err.message)
      return NextResponse.json(
        {
          error: `${err.service ?? 'Backend service'} rejected the admin panel's credentials. Check GATEWAY_ADMIN_KEY (or the service internal key).`,
          code: 'SERVICE_AUTH_FAILED',
        },
        { status: 502 }
      )
    }
    const status = err.status >= 500 ? 502 : err.status
    if (err.status >= 500) console.error(tag, err.service, err.status, err.message)
    return NextResponse.json({ error: err.message, code: err.code }, { status })
  }
  const code = (err as { code?: string } | null)?.code
  if (code === '23505') {
    return NextResponse.json({ error: 'A conflicting record already exists.' }, { status: 409 })
  }
  console.error(tag, err)
  return NextResponse.json({ error: 'Action failed' }, { status: 500 })
}

/** Used for best-effort follow-ups (search reindex, cache clear). Never throws. */
export async function bestEffort(label: string, fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn()
    return true
  } catch (err) {
    console.warn(`[best-effort] ${label} failed:`, err instanceof Error ? err.message : err)
    return false
  }
}