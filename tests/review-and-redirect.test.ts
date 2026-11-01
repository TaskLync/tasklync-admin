import { describe, it, expect } from 'vitest'
import { resultingStatus } from '@/lib/review-constants'
import { safeNextPath } from '@/lib/auth/redirect'
import { mapSignedDocuments } from '@/lib/services/worker'

describe('review moderation transitions', () => {
  it('hides visible and auto-hidden reviews', () => {
    expect(resultingStatus('hide', 'VISIBLE')).toBe('ADMIN_HIDDEN')
    expect(resultingStatus('hide', 'ADMIN_HIDDEN')).toBeNull()
  })
  it('dismiss restores auto-hidden only', () => {
    expect(resultingStatus('dismiss', 'AUTO_HIDDEN')).toBe('ADMIN_RESTORED')
    expect(resultingStatus('dismiss', 'ADMIN_HIDDEN')).toBeNull()
  })
})

describe('safeNextPath', () => {
  it('blocks open redirects', () => {
    expect(safeNextPath('//evil.com')).toBe('/')
    expect(safeNextPath('/\\evil.com')).toBe('/')
    expect(safeNextPath('/api/admin/x')).toBe('/')
    expect(safeNextPath('/bookings?x=1')).toBe('/bookings?x=1')
  })
})

describe('mapSignedDocuments', () => {
  it('never exposes the raw file_url', () => {
    const out = mapSignedDocuments({
      documents: [{ id: '1', type: 'CNIC_FRONT', status: 'PENDING', file_url: 'https://raw/secret', signed_url: 'https://signed/x' }],
    })
    expect(out[0].fileUrl).toBe('https://signed/x')
    expect(JSON.stringify(out)).not.toContain('raw/secret')
  })
  it('returns an empty url when nothing is signed', () => {
    const out = mapSignedDocuments({ documents: [{ id: '1', type: 'CNIC_BACK', status: 'PENDING', file_url: 'https://raw/x' }] })
    expect(out[0].fileUrl).toBe('')
  })
})