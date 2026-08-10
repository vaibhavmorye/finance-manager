import { cn } from '@/lib/utils'

interface CheckboxProps {
  id?: string
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

export function Checkbox({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
  className,
}: CheckboxProps) {
  const inputId = id ?? label.replace(/\s+/g, '-').toLowerCase()
  return (
    <label
      htmlFor={inputId}
      className={cn(
        'flex cursor-pointer gap-3 rounded-xl border border-surface-200 bg-surface-50/80 p-3 transition hover:border-brand-300 dark:border-surface-700 dark:bg-surface-800/40 dark:hover:border-brand-700',
        disabled && 'cursor-not-allowed opacity-60',
        checked && 'border-brand-400 bg-brand-50/50 dark:border-brand-700 dark:bg-brand-900/20',
        className,
      )}
    >
      <input
        id={inputId}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-surface-800 dark:text-surface-100">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-surface-500 dark:text-surface-400">{description}</span>
        )}
      </span>
    </label>
  )
}
