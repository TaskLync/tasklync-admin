// components/ui/Badge.tsx
import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: 'bg-[#DCFCE7] text-[#16A34A]',
  warning: 'bg-[#FEF3C7] text-[#D97706]',
  danger: 'bg-[#FEE2E2] text-[#DC2626]',
  info: 'bg-[#DBEAFE] text-[#2563EB]',
  neutral: 'bg-[#F3F4F6] text-[#6B7280]',
}

export function Badge({ className, tone = 'neutral', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        TONE_CLASSES[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}