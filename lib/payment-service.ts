// lib/payment-service.ts
// Server-only HTTP client for payment-service /internal/* routes.
// The admin panel never writes payment tables itself.

export class PaymentServiceError extends Error {
  status: number
  code?: string
  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

const BASE = process.env.PAYMENT_SERVICE_URL
const KEY = process.env.PAYMENT_SERVICE_INTERNAL_KEY
const TIMEOUT_MS = 20_000

export async function callPaymentService<T = unknown>(
  method: 'GET' | 'POST',
  path: string,
  body?: object
): Promise<T> {
  if (!BASE || !KEY) {
    throw new PaymentServiceError(
      503,
      'payment-service is not configured (PAYMENT_SERVICE_URL / PAYMENT_SERVICE_INTERNAL_KEY).'
    )
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(`${BASE.replace(/\/$/, '')}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-internal-key': KEY },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: 'no-store',
    })
  } catch {
    throw new PaymentServiceError(503, 'payment-service is unreachable. Try again in a moment.')
  } finally {
    clearTimeout(timer)
  }

  const json = await res.json().catch(() => ({}))

  if (!res.ok) {
    // payment-service error shape: { success:false, error:{ code, message } }
    throw new PaymentServiceError(
      res.status,
      json?.error?.message ?? 'payment-service rejected the request',
      json?.error?.code
    )
  }
  return (json?.data ?? json) as T
}