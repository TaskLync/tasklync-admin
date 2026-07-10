// components/waitlist/WaitlistTableSection.tsx
'use client'

import { useUtmBreakdown } from '@/hooks/useWaitlist'
import { WaitlistTable } from './WaitlistTable'

export function WaitlistTableSection() {
  const { data } = useUtmBreakdown()
  const utmSources = (data?.rows ?? [])
    .map((r) => r.utm_source)
    .filter((s): s is string => Boolean(s))

  return <WaitlistTable utmSources={utmSources} />
}