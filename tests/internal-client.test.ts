import { afterEach, describe, expect, it, vi } from 'vitest'
import { serviceAuthHeaders } from '@/lib/internal-client'

describe('service authentication mode', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('uses the internal key when the URL is the service itself', () => {
    expect(serviceAuthHeaders('http://booking-service:3004', 'svc-key')).toEqual({ 'x-internal-key': 'svc-key' })
    expect(serviceAuthHeaders('http://booking-service:3004', undefined)).toBeNull()
  })

  it('uses only the gateway admin key through the gateway side door (no internal key sent)', () => {
    vi.stubEnv('GATEWAY_ADMIN_KEY', 'g'.repeat(40))
    expect(serviceAuthHeaders('https://api.tasklync.pk/internal-admin/booking', 'svc-key')).toEqual({
      'x-admin-internal-key': 'g'.repeat(40),
    })
  })

  it('is not configured through the gateway without GATEWAY_ADMIN_KEY', () => {
    vi.stubEnv('GATEWAY_ADMIN_KEY', '')
    expect(serviceAuthHeaders('https://api.tasklync.pk/internal-admin/booking', 'svc-key')).toBeNull()
  })
})
