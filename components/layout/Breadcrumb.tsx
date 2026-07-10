// components/layout/Breadcrumb.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { NAV_ITEMS } from '@/lib/nav-config'

function humanize(segment: string) {
  // e.g. "workerId" style dynamic segments just get labeled generically
  if (/^[0-9a-fA-F-]{8,}$/.test(segment)) return `#${segment.slice(0, 8)}`
  return segment
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function Breadcrumb() {
  const pathname = usePathname()

  if (pathname === '/') {
    return <span className="text-sm font-medium text-gray-700">Dashboard</span>
  }

  const segments = pathname.split('/').filter(Boolean)
  const topLevelMatch = NAV_ITEMS.find((item) => item.href === `/${segments[0]}`)

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Link href="/" className="text-gray-400 transition-colors duration-150 hover:text-gray-600">
        Dashboard
      </Link>
      {segments.map((segment, i) => {
        const href = '/' + segments.slice(0, i + 1).join('/')
        const isLast = i === segments.length - 1
        const label = i === 0 && topLevelMatch ? topLevelMatch.label : humanize(segment)

        return (
          <span key={href} className="flex items-center gap-1.5">
            <ChevronRight size={14} className="text-gray-300" />
            {isLast ? (
              <span className="font-medium text-gray-700">{label}</span>
            ) : (
              <Link href={href} className="text-gray-400 transition-colors duration-150 hover:text-gray-600">
                {label}
              </Link>
            )}
          </span>
        )
      })}
    </div>
  )
}