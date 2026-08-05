import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  className?: string
}

const variants = {
  default: 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-300',
  success: 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  danger: 'bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  info: 'bg-sky-50 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-medium',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
