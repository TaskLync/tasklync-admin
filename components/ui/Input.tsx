// components/ui/Input.tsx
import { forwardRef, type InputHTMLAttributes, useId } from 'react'
import { cn } from '@/lib/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const generatedId = useId()
    const inputId = id ?? generatedId

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-gray-700">
            {label}
          </label>
        )}

        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cn(
            'h-9 rounded-md border px-3 text-sm text-gray-900 placeholder:text-gray-400',
            'transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-0',
            error
              ? 'border-red-400 focus:ring-red-500'
              : 'border-gray-300 focus:border-[#1F6F5F] focus:ring-[#1F6F5F]',
            'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400',
            className
          )}
          {...props}
        />

        {error && (
          <p id={`${inputId}-error`} className="text-xs text-red-600">
            {error}
          </p>
        )}
        {!error && helperText && <p className="text-xs text-gray-400">{helperText}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'