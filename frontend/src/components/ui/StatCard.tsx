import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string
  sub?: string
  icon?: ReactNode
  trend?: 'up' | 'down' | 'neutral'
  className?: string
}

export function StatCard({ label, value, sub, icon, trend, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-surface-200/80 bg-white p-5 shadow-sm dark:border-surface-700/80 dark:bg-surface-900',
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-surface-500 dark:text-surface-400">{label}</span>
        {icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-400">
            {icon}
          </span>
        )}
      </div>
      <p className="font-mono text-2xl font-semibold tracking-tight text-surface-900 dark:text-surface-50">
        {value}
      </p>
      {sub && (
        <p
          className={cn(
            'mt-1 text-xs',
            trend === 'up' && 'text-brand-600',
            trend === 'down' && 'text-accent-rose',
            (!trend || trend === 'neutral') && 'text-surface-400',
          )}
        >
          {sub}
        </p>
      )}
    </div>
  )
}
