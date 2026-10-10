// lib/verification-constants.ts
// Shared by server routes AND client components. No server-only imports here.

export const REJECTION_REASONS = [
  { code: 'cnic_unclear', label: 'CNIC unclear' },
  { code: 'face_mismatch', label: "Face doesn't match" },
  { code: 'invalid_documents', label: 'Invalid documents' },
  { code: 'fake_information', label: 'Fake information' },
  { code: 'duplicate_account', label: 'Duplicate account' },
  { code: 'other', label: 'Other' },
] as const

export type RejectionCode = (typeof REJECTION_REASONS)[number]['code']

export const REJECTION_CODES: string[] = REJECTION_REASONS.map((r) => r.code)

export function rejectionLabel(code: string | null | undefined): string {
  if (!code) return '—'
  return REJECTION_REASONS.find((r) => r.code === code)?.label ?? code
}

// SLA: row turns amber after 48h waiting, red after 72h.
export const SLA_AMBER_HOURS = 48
export const SLA_RED_HOURS = 72

export const QUEUE_TABS = ['pending', 'resubmitted', 'approved', 'rejected'] as const
export type QueueTab = (typeof QUEUE_TABS)[number]

// Pakistani CNIC: 13 digits, usually written 35202-1234567-1
export const CNIC_RE = /^\d{13}$/

export function normalizeCnic(input: string): string {
  return input.replace(/[\s-]/g, '')
}

export function formatCnic(digits: string | null | undefined): string {
  if (!digits) return '—'
  if (!CNIC_RE.test(digits)) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`
}