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
  query?: Record<string, string | number | undefined>
  timeoutMs?: number
}

export async function callService<T = unknown>(
  target: ServiceTarget,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  opts: CallOptions = {}
): Promise<T> {
  if (!target.url || !target.key) {
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
      headers: { 'Content-Type': 'application/json', 'x-internal-key': target.key },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
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