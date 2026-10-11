// components/notifications/NotificationsSection.tsx
'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { cn } from '@/lib/cn'
import { NOTIFICATION_TABS, type NotificationTab } from '@/lib/notification-constants'
import ComposeTab, { type ComposeSeed } from './ComposeTab'
import HistoryTab from './HistoryTab'
import TemplatesTab from './TemplatesTab'

const TAB_LABEL: Record<NotificationTab, string> = {
  compose: 'Compose',
  history: 'History',
  templates: 'Templates',
}

const TAB_HINT: Record<NotificationTab, string> = {
  compose: 'Send a push or SMS to a group of users or workers. Booking, payment and chat notifications are automatic and not listed here.',
  history: 'Every broadcast that was sent, with status and recipients. Click one for delivery details.',
  templates: 'Ready-made messages in English and Roman Urdu. Pick one to prefill the composer.',
}

export default function NotificationsSection() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const validTab = (NOTIFICATION_TABS as readonly string[]).includes(tabParam ?? '')

  const [tab, setTab] = useState<NotificationTab>(validTab ? (tabParam as NotificationTab) : 'compose')
  const [seed, setSeed] = useState<ComposeSeed | null>(null)
  // bump to remount the composer when a template is chosen from the Templates tab
  const [composeKey, setComposeKey] = useState(0)

  function useTemplate(next: ComposeSeed) {
    setSeed(next)
    setComposeKey((k) => k + 1)
    setTab('compose')
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex flex-wrap gap-1 border-b border-gray-200">
          {NOTIFICATION_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'border-b-2 px-3 py-2 text-sm transition-colors duration-150',
                tab === t
                  ? 'border-[#1F6F5F] font-medium text-[#1F6F5F]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500">{TAB_HINT[tab]}</p>
      </div>

      {tab === 'compose' && <ComposeTab key={composeKey} seed={seed} />}
      {tab === 'history' && <HistoryTab />}
      {tab === 'templates' && <TemplatesTab onUse={useTemplate} />}
    </div>
  )
}