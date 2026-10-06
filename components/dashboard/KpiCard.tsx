'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Sparkline } from './Sparkline'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { cn } from '@/lib/cn'

interface KpiCardProps {
  label: string
  value: string
  changePct?: number | null
  sparkline?: number[]
  color?: string
}

export function KpiCard({
  label,
  value,
  changePct = null,
  sparkline = [],
  color,
}: KpiCardProps) {
  const [clicked, setClicked] = useState(false)

  const isPositive = (changePct ?? 0) >= 0
  const isColored = Boolean(color) && !clicked

  return (
    <Card
      onClick={() => setClicked((c) => !c)}
      className={cn(
        'flex min-h-[150px] flex-col gap-2 p-4 transition-colors duration-150',
        color && 'cursor-pointer'
      )}
      style={isColored ? { backgroundColor: color, borderColor: color } : undefined}
    >
      <span
        className={cn(
          'text-xs font-medium uppercase tracking-wide',
          isColored ? 'text-white/80' : 'text-gray-500'
        )}
      >
        {label}
      </span>

      <div className="flex items-end justify-between gap-3">
        <span
          className={cn(
            'text-2xl font-semibold',
            isColored ? 'text-white' : 'text-gray-900'
          )}
        >
          {value}
        </span>

        <div className="flex h-10 w-24 items-end justify-end">
          {sparkline.length > 0 && (
            <Sparkline data={sparkline} positive={isPositive} />
          )}
        </div>
      </div>

      <div className="mt-auto h-5">
        {changePct !== null && (
          <div
            className={cn(
              'flex items-center gap-1 text-xs font-medium',
              isColored
                ? 'text-white/90'
                : isPositive
                  ? 'text-[#16A34A]'
                  : 'text-[#DC2626]'
            )}
          >
            {isPositive ? (
              <ArrowUpRight size={14} />
            ) : (
              <ArrowDownRight size={14} />
            )}
            {Math.abs(changePct).toFixed(1)}% vs yesterday
          </div>
        )}
      </div>
    </Card>
  )
}

export function KpiCardSkeleton() {
  return (
    <Card className="flex min-h-[150px] flex-col gap-2 p-4">
      <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
      <div className="h-7 w-20 animate-pulse rounded bg-gray-200" />
      <div className="mt-auto h-5 w-28 animate-pulse rounded bg-gray-200" />
    </Card>
  )
}