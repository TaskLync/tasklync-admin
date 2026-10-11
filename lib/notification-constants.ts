// lib/notification-constants.ts
// Shared by server routes AND client components. No server-only imports here.

export const BROADCAST_STATUSES = ['DRAFT', 'SENDING', 'COMPLETED', 'FAILED'] as const
export type BroadcastStatus = (typeof BROADCAST_STATUSES)[number]

export const SEGMENT_TYPES = ['all_users', 'all_workers', 'category_city', 'custom_ids'] as const
export type SegmentType = (typeof SEGMENT_TYPES)[number]

/** Segments that hit everyone: SUPER_ADMIN only, typed confirmation. */
export const BROAD_SEGMENTS: readonly SegmentType[] = ['all_users', 'all_workers']

/** notification-service only accepts these two for broadcasts. */
export const BROADCAST_CATEGORIES = ['platform', 'marketing'] as const
export type BroadcastCategory = (typeof BROADCAST_CATEGORIES)[number]

/** Email has no broadcast template yet, so it is not offered here. */
export const DELIVERY_CHANNELS = ['push', 'sms'] as const
export type DeliveryChannel = (typeof DELIVERY_CHANNELS)[number]

export const NOTIFICATION_TABS = ['compose', 'history', 'templates'] as const
export type NotificationTab = (typeof NOTIFICATION_TABS)[number]

/** Generic template shipped with the generator script (title/body/deepLink come from the admin). */
export const CUSTOM_TEMPLATE_KEY = 'admin_custom_message'

/** Confirm the real deep links with the mobile team. */
export const DEFAULT_DEEP_LINK = 'tasklync://home'
export const DEEP_LINK_RE = /^tasklync:\/\/[A-Za-z0-9/_\-.?=&]+$/

export const LIMITS = {
  label: 200, // broadcast_campaigns.title is VARCHAR(200)
  title: 65,
  pushBody: 178,
  smsBody: 150, // SMS template prefixes "TaskLync: "
  specificPeople: 500,
} as const

/** notification-service dedups (recipient, template_key) for 30s, so refuse a relaunch inside 35s. */
export const DUPLICATE_LAUNCH_WINDOW_SECONDS = 35

/** Matches QUIET_HOURS_* in notification-service. Normal-priority push/SMS is DROPPED in this window. */
export const QUIET_HOURS = { startHour: 22, endHour: 8, timezone: 'Asia/Karachi' } as const

export function karachiHour(date: Date = new Date()): number {
  const part = new Intl.DateTimeFormat('en-GB', {
    timeZone: QUIET_HOURS.timezone,
    hour: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(date)
    .find((p) => p.type === 'hour')
  return Number(part?.value ?? 0) % 24
}

export function isQuietHours(date: Date = new Date()): boolean {
  const h = karachiHour(date)
  return h >= QUIET_HOURS.startHour || h < QUIET_HOURS.endHour
}