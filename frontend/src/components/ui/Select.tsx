import { cn } from '@/lib/utils'
import type { SelectHTMLAttributes } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
}

export function Select({ className, label, error, options, id, ...props }: SelectProps) {
  const selectId = id ?? props.name
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-surface-700 dark:text-surface-300">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={cn(
          'h-10 w-full rounded-xl border border-surface-300 bg-white px-3 text-sm text-surface-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-50',
          error && 'border-accent-rose',
          className,
        )}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-accent-rose">{error}</p>}
    </div>
  )
}
