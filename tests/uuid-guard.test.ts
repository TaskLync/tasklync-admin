import { describe, it, expect } from 'vitest'
import { hasInvalidIdSegment } from '@/lib/auth/uuid-guard'

const id = '3ad31163-dcda-481b-adeb-0e3305d50e8a'

describe('hasInvalidIdSegment', () => {
  it('accepts uuids', () => {
    expect(hasInvalidIdSegment(`/api/admin/users/${id}`)).toBe(false)
    expect(hasInvalidIdSegment(`/api/admin/users/${id}/actions/ban`)).toBe(false)
  })
  it('rejects junk ids', () => {
    expect(hasInvalidIdSegment('/api/admin/users/abc')).toBe(true)
    expect(hasInvalidIdSegment("/api/admin/bookings/1;drop table")).toBe(true)
  })
  it('lets static sub-routes through', () => {
    expect(hasInvalidIdSegment('/api/admin/users/kpis')).toBe(false)
    expect(hasInvalidIdSegment('/api/admin/workers/verification/counts')).toBe(false)
    expect(hasInvalidIdSegment('/api/admin/bookings/board')).toBe(false)
  })
  it('does not guard category slugs', () => {
    expect(hasInvalidIdSegment('/api/admin/categories/ac-repair')).toBe(false)
  })
})