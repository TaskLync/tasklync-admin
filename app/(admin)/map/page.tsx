// app/(admin)/map/page.tsx
import { Suspense } from 'react'
import MapSection from '@/components/map/MapSection'

export const metadata = { title: 'Live Map | Tasklync Admin' }

// Full-bleed page: no px-6 py-5 wrapper (the map fills the area under the 3.5rem header).
export default function MapPage() {
  return (
    <Suspense fallback={<div className="h-[calc(100vh-3.5rem)] animate-pulse bg-gray-100" />}>
      <MapSection />
    </Suspense>
  )
}