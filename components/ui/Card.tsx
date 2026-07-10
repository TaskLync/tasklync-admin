// components/ui/Card.tsx
import { type HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/cn'

export type CardProps = HTMLAttributes<HTMLDivElement>

export const Card = forwardRef<HTMLDivElement, CardProps>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('rounded-lg border border-gray-200 bg-white shadow-sm', className)}
      {...props}
    />
  )
})

Card.displayName = 'Card'

// Optional sub-components for pages that want a consistent card header/body
// split (not required — the Dashboard components you have don't use these).
export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('border-b border-gray-100 px-4 py-3', className)}
      {...props}
    />
  )
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4', className)} {...props} />
}