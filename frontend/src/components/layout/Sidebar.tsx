import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Wallet,
  TrendingUp,
  Landmark,
  Receipt,
  Shield,
  Calculator,
  Settings,
  Moon,
  Sun,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { useFinanceStore } from '@/store/financeStore'
import { formatCurrency } from '@/lib/utils'
import { calculateNetWorth } from '@/lib/finance/networth'
import { useMemo } from 'react'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/income', label: 'Income', icon: Wallet },
  { to: '/investments', label: 'Investments', icon: TrendingUp },
  { to: '/debts', label: 'Debts', icon: Landmark },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/insurance', label: 'Insurance', icon: Shield },
  { to: '/calculators', label: 'Calculators', icon: Calculator },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const { theme, setTheme } = useTheme()
  const store = useFinanceStore()
  const netWorth = useMemo(() => calculateNetWorth(store), [store])
  const currency = store.profile.currency

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900 lg:flex">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 font-bold text-white">
          F
        </div>
        <div>
          <p className="text-sm font-semibold text-surface-900 dark:text-surface-50">Finance Manager</p>
          <p className="text-xs text-surface-400">Private · Local-first</p>
        </div>
      </div>

      <div className="mx-4 mb-4 rounded-xl bg-surface-50 px-3 py-3 dark:bg-surface-800/60">
        <p className="text-xs text-surface-400">Net worth</p>
        <p className="font-mono text-sm font-semibold text-surface-900 dark:text-surface-50">
          {formatCurrency(netWorth.netWorth, currency, { compact: true })}
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                isActive
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                  : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900 dark:text-surface-400 dark:hover:bg-surface-800 dark:hover:text-surface-100',
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-surface-200 p-4 dark:border-surface-800">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-surface-600 hover:bg-surface-50 dark:text-surface-400 dark:hover:bg-surface-800"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
        {store.profile.name && (
          <p className="mt-2 truncate px-3 text-xs text-surface-400">Hi, {store.profile.name}</p>
        )}
      </div>
    </aside>
  )
}

export function MobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-surface-200 bg-white/95 backdrop-blur dark:border-surface-800 dark:bg-surface-900/95 lg:hidden">
      {nav.slice(0, 5).map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium',
              isActive ? 'text-brand-600' : 'text-surface-400',
            )
          }
        >
          <item.icon className="h-5 w-5" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
