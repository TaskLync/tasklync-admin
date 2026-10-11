// app/(admin)/notifications/page.tsx
import { Suspense } from 'react'
import NotificationsSection from '@/components/notifications/NotificationsSection'
import { NotificationKpiGrid } from '@/components/notifications/NotificationKpiGrid'

export const metadata = { title: 'Notifications | Tasklync Admin' }

export default function NotificationsPage() {
  return (
    <div className="px-6 py-5">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-gray-900">Notifications</h1>
        <p className="text-sm text-gray-500">
          Send announcements, offers and greetings to the right group, and see how each one performed.
        </p>
      </div>
      <div className="mb-4">
        <NotificationKpiGrid />
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-gray-100" />}>
        <NotificationsSection />
      </Suspense>
    </div>
  )
}