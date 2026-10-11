// lib/notification-service.ts
// Server-only. Calls the API gateway, which forwards to notification-service.
import type { BroadcastCategory, DeliveryChannel, SegmentType } from '@/lib/notification-constants'

export class NotificationServiceError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export interface ServiceBroadcastPayload {
  title: string
  template_key: string
  template_data: Record<string, unknown>
  channels: DeliveryChannel[]
  category: BroadcastCategory
  segment_type: SegmentType
  segment_filter: Record<string, unknown>
  created_by: string
}

export async function launchBroadcast(
  payload: ServiceBroadcastPayload
): Promise<{ campaign_id: string; status: string }> {
  const base = process.env.API_GATEWAY_URL
  const adminKey = process.env.GATEWAY_ADMIN_KEY
  if (!base || !adminKey) {
    throw new NotificationServiceError(
      503,
      'NOT_CONFIGURED',
      'API_GATEWAY_URL or GATEWAY_ADMIN_KEY is not set on the admin panel.'
    )
  }

  const url = `${base.replace(/\/$/, '')}/internal-admin/notifications/broadcasts`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 10_000)

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-internal-key': adminKey,
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
      cache: 'no-store',
    })
  } catch (err) {
    console.error('[notification-service] request failed', url, err)
    throw new NotificationServiceError(
      503,
      'UNREACHABLE',
      'API gateway is unreachable. Check that it is running and reachable from the admin server.'
    )
  } finally {
    clearTimeout(timer)
  }

  const text = await res.text()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let json: any = null
  try {
    json = JSON.parse(text)
  } catch {
    /* response was not JSON */
  }

  if (!res.ok) {
    console.error('[notification-service] broadcast rejected', res.status, text.slice(0, 1000))
    const detail =
      json?.error?.message ??
      (typeof json?.error === 'string' ? json.error : null) ??
      json?.message ??
      `HTTP ${res.status}: ${text.slice(0, 200)}`
    throw new NotificationServiceError(res.status, json?.error?.code ?? 'SERVICE_ERROR', detail)
  }

  // Accept { success, data: { campaign_id } } or a bare { campaign_id }.
  const data = json?.data ?? json
  if (!data?.campaign_id) {
    console.error('[notification-service] unexpected response', res.status, text.slice(0, 1000))
    throw new NotificationServiceError(
      502,
      'BAD_RESPONSE',
      `Unexpected response from service: ${text.slice(0, 200)}`
    )
  }
  return data
}