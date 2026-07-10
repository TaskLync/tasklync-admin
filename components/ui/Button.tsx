// components/ui/Button.tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost'
type ButtonSize = 'sm' | 'md'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-[#1F6F5F] text-white hover:bg-[#195c4f] focus-visible:ring-[#1F6F5F]',
  secondary:
    'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-[#1F6F5F]',
  destructive: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600',
  ghost: 'text-gray-600 hover:bg-gray-50 focus-visible:ring-[#1F6F5F]',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-xs',
  md: 'h-9 px-3 text-sm',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = 'primary', size = 'md', loading = false, disabled, children, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 rounded-md font-medium',
          'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
          'disabled:cursor-not-allowed disabled:opacity-60',
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className
        )}
        {...props}
      >
        {loading && (
          <svg
            className="h-3.5 w-3.5 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'