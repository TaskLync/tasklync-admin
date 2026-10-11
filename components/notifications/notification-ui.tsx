// components/notifications/notification-ui.tsx
// Labels, tones and small shared pieces for every notification component.
import type { BadgeTone } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import type { TemplateKind } from '@/lib/notification-catalog'
import type { BroadcastCategory, BroadcastStatus, DeliveryChannel } from '@/lib/notification-constants'

export { Field, KNOWN_CITIES, Pager, SELECT_CLASS } from '@/components/payments/payment-ui'
export { formatDateTime, shortId, timeAgo } from '@/components/bookings/booking-ui'

export const STATUS_LABEL: Record<BroadcastStatus, string> = {
  DRAFT: 'Draft',
  SENDING: 'Sending…',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
}

export const STATUS_TONE: Record<BroadcastStatus, BadgeTone> = {
  DRAFT: 'neutral',
  SENDING: 'info',
  COMPLETED: 'success',
  FAILED: 'danger',
}

export const CATEGORY_LABEL: Record<BroadcastCategory, string> = {
  platform: 'Operational announcement',
  marketing: 'Marketing / promotion',
}

export const CATEGORY_HINT: Record<BroadcastCategory, string> = {
  platform: 'Outages, maintenance, safety notices. Push is ON by default for everyone.',
  marketing: 'Discounts and festive greetings. Push is OFF by default, so only people who opted in get a buzz.',
}

export const KIND_LABEL: Record<TemplateKind, string> = {
  operational: 'Operational',
  promo: 'Promotions',
  greeting: 'Occasions & greetings',
  seasonal: 'Seasonal services',
}

export const CHANNEL_LABEL: Record<DeliveryChannel, string> = { push: 'Push', sms: 'SMS' }

export function prettify(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function audienceLabel(type: string, filter: Record<string, unknown>): string {
  switch (type) {
    case 'all_users':
      return 'All users'
    case 'all_workers':
      return 'All workers'
    case 'category_city':
      return `${prettify(String(filter.category_id ?? ''))} workers · ${String(filter.city ?? '—')}`
    case 'custom_ids': {
      const users = (filter.user_ids as unknown[] | undefined)?.length
      const workers = (filter.worker_ids as unknown[] | undefined)?.length
      return users
        ? `${users} specific user${users === 1 ? '' : 's'}`
        : `${workers ?? 0} specific worker${workers === 1 ? '' : 's'}`
    }
    default:
      return type
  }
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex w-fit rounded-md border border-gray-300 bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'h-8 rounded px-3 text-sm transition-colors duration-150',
            value === o.value
              ? 'bg-[#1F6F5F]/10 font-medium text-[#1F6F5F]'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Counter({ value, max }: { value: number; max: number }) {
  return (
    <span className={cn('text-[11px]', value > max ? 'text-red-600' : 'text-gray-400')}>
      {value}/{max}
    </span>
  )
}