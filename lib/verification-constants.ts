// lib/verification-constants.ts
// Shared by server routes AND client components. No server-only imports here.

export const REJECTION_REASONS = [
  { code: 'ID_UNCLEAR', label: 'ID unclear' },
  { code: 'ID_MISMATCH', label: "ID doesn't match the profile" },
  { code: 'ID_EXPIRED', label: 'ID expired' },
  { code: 'DUPLICATE_ACCOUNT', label: 'Duplicate account' },
  { code: 'FAKE_DOCUMENT', label: 'Fake document' },
  { code: 'OTHER', label: 'Other' },
] as const

export type RejectionCode = (typeof REJECTION_REASONS)[number]['code']

export const REJECTION_CODES: string[] = REJECTION_REASONS.map((r) => r.code)

// Rows rejected before v1.1.0 may still carry the old lower-case codes.
const LEGACY_LABEL: Record<string, string> = {
  cnic_unclear: 'CNIC unclear',
  face_mismatch: "Face doesn't match",
  invalid_documents: 'Invalid documents',
  fake_information: 'Fake information',
  duplicate_account: 'Duplicate account',
  other: 'Other',
}

export function rejectionLabel(code: string | null | undefined): string {
  if (!code) return '—'
  return REJECTION_REASONS.find((r) => r.code === code)?.label ?? LEGACY_LABEL[code] ?? code
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