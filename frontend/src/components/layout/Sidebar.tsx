import { useMemo, useRef, useState } from 'react'
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
  FileText,
  LogOut,
  Target,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { useFinanceStore } from '@/store/financeStore'
import { formatCurrency } from '@/lib/utils'
import { calculateNetWorth } from '@/lib/finance/networth'
import { isApiMode, hasToken } from '@/lib/api'
import { needsBackupPrompt, performSessionExit } from '@/lib/backupGuard'
import { BackupLeaveModal } from '@/components/BackupLeaveModal'
import { BackupPasswordModal } from '@/components/BackupPasswordModal'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/income', label: 'Income', icon: Wallet },
  { to: '/investments', label: 'Investments', icon: TrendingUp },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/debts', label: 'Debts', icon: Landmark },
  { to: '/cashflow', label: 'Cash flow', icon: Receipt },
  { to: '/tax', label: 'Tax', icon: FileText },
  { to: '/insurance', label: 'Insurance', icon: Shield },
  { to: '/calculators', label: 'Calculators', icon: Calculator },
  { to: '/settings', label: 'Settings', icon: Settings },
]

/** Public nav for guests (no login / onboarding) — calculators stay usable. */
const guestNav = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/calculators', label: 'Calculators', icon: Calculator },
]

function useGuestMode(): boolean {
  const complete = useFinanceStore((s) => s.profile.onboardingComplete)
  if (isApiMode()) return !hasToken()
  return !complete
}

export function Sidebar() {
  const { theme, setTheme } = useTheme()
  const store = useFinanceStore()
  const guest = useGuestMode()
  const items = guest ? guestNav : nav
  const netWorth = useMemo(() => calculateNetWorth(store), [store])
  const currency = store.profile.currency

  const [leaveOpen, setLeaveOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const exitAfterExport = useRef(false)

  const requestLogout = () => {
    if (needsBackupPrompt()) {
      setLeaveOpen(true)
      return
    }
    performSessionExit()
  }

  const handleExportThenExit = async (password: string) => {
    setBusy(true)
    setPasswordError(null)
    try {
      await store.exportData(password)
      setExportOpen(false)
      if (exitAfterExport.current) {
        exitAfterExport.current = false
        performSessionExit()
      }
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900 lg:flex">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 font-bold text-white">
          F
        </div>
        <div>
          <p className="text-sm font-semibold text-surface-900 dark:text-surface-50">Finance Manager</p>
          <p className="text-xs text-surface-400">
            {guest ? 'Calculators · No account needed' : isApiMode() ? 'Synced · API' : 'Private · Local-first'}
          </p>
        </div>
      </div>

      {!guest && (
        <div className="mx-4 mb-4 rounded-xl bg-surface-50 px-3 py-3 dark:bg-surface-800/60">
          <p className="text-xs text-surface-400">Net worth</p>
          <p className="font-mono text-sm font-semibold text-surface-900 dark:text-surface-50">
            {formatCurrency(netWorth.netWorth, currency, { compact: true })}
          </p>
        </div>
      )}

      <nav className="flex flex-1 flex-col gap-0.5 px-3">
        {items.map((item) => (
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
        {!guest && store.profile.name && (
          <div className="mt-2 px-3">
            <p className="truncate text-xs text-surface-400">Hi, {store.profile.name}</p>
            <button
              type="button"
              onClick={requestLogout}
              className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-surface-500 transition hover:text-accent-rose dark:text-surface-400 dark:hover:text-accent-rose"
            >
              <LogOut className="h-3.5 w-3.5" />
              Log out
            </button>
          </div>
        )}
      </div>

      <BackupLeaveModal
        open={leaveOpen}
        onCancel={() => setLeaveOpen(false)}
        onLeaveWithoutBackup={() => {
          setLeaveOpen(false)
          performSessionExit()
        }}
        onExportBackup={() => {
          setLeaveOpen(false)
          exitAfterExport.current = true
          setPasswordError(null)
          setExportOpen(true)
        }}
      />
      <BackupPasswordModal
        open={exportOpen}
        mode="export"
        busy={busy}
        error={passwordError}
        onClose={() => {
          if (busy) return
          exitAfterExport.current = false
          setExportOpen(false)
        }}
        onSubmit={handleExportThenExit}
      />
    </aside>
  )
}

export function MobileNav() {
  const guest = useGuestMode()
  const items = guest ? guestNav : nav.slice(0, 5)

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-surface-200 bg-white/95 backdrop-blur dark:border-surface-800 dark:bg-surface-900/95 lg:hidden">
      {items.map((item) => (
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
