import { cn } from '@/lib/utils'
import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export function Input({ className, label, error, hint, id, ...props }: InputProps) {
  const inputId = id ?? props.name
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-surface-700 dark:text-surface-300">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'h-10 w-full rounded-xl border border-surface-300 bg-white px-3 text-sm text-surface-900 placeholder:text-surface-400 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-50 dark:placeholder:text-surface-500',
          error && 'border-accent-rose focus:border-accent-rose focus:ring-accent-rose/20',
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-accent-rose">{error}</p>}
      {hint && !error && <p className="text-xs text-surface-400">{hint}</p>}
    </div>
  )
}
