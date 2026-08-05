import { cn } from '@/lib/utils'

interface TabsProps {
  tabs: { id: string; label: string }[]
  active: string
  onChange: (id: string) => void
  className?: string
}

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div
      className={cn(
        'inline-flex rounded-xl bg-surface-100 p-1 dark:bg-surface-800',
        className,
      )}
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-sm font-medium transition',
            active === tab.id
              ? 'bg-white text-surface-900 shadow-sm dark:bg-surface-700 dark:text-surface-50'
              : 'text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
