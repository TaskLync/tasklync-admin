// components/shared/StatusBadge.tsx
import { cn } from '@/lib/cn'

const STATUS_STYLES: Record<string, string> = {
  pending: 'text-[#D97706] bg-[#FEF3C7]',
  invited: 'text-[#2563EB] bg-[#DBEAFE]',
  converted: 'text-[#16A34A] bg-[#DCFCE7]',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  invited: 'Invited',
  converted: 'Converted',
}

const VARIANT_STYLES: Record<'success' | 'warning' | 'danger' | 'neutral', string> = {
  success: 'text-[#16A34A] bg-[#DCFCE7]',
  warning: 'text-[#D97706] bg-[#FEF3C7]',
  danger: 'text-[#DC2626] bg-[#FEE2E2]',
  neutral: 'text-[#6B7280] bg-[#F3F4F6]',
}

const DEFAULT_STYLE = 'text-[#6B7280] bg-[#F3F4F6]'

interface StatusBadgeProps {
  status: string
  variant?: 'success' | 'warning' | 'danger' | 'neutral'
  label?: string
}

export function StatusBadge({ status, variant, label }: StatusBadgeProps) {
  const style = variant ? VARIANT_STYLES[variant] : (STATUS_STYLES[status] ?? DEFAULT_STYLE)
  const text = label ?? STATUS_LABELS[status] ?? status

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        style
      )}
    >
      {text}
    </span>
  )
}