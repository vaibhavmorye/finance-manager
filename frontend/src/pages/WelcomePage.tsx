import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, UserPlus, Shield, Lock, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui'
import { useFinanceStore } from '@/store/financeStore'

export function WelcomePage() {
  const navigate = useNavigate()
  const importData = useFinanceStore((s) => s.importData)
  const loadDemoData = useFinanceStore((s) => s.loadDemoData)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await importData(file)
      navigate('/')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to import file')
    }
  }

  const handleDemo = () => {
    loadDemoData()
    navigate('/')
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--color-brand-100)_0%,_transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.15)_0%,_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent,var(--color-surface-50))] dark:bg-[linear-gradient(to_bottom,transparent,var(--color-surface-950))]" />

      <div className="relative z-10 w-full max-w-lg">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-xl font-bold text-white shadow-lg shadow-brand-600/30">
            F
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-surface-900 dark:text-surface-50 sm:text-4xl">
            Finance Manager
          </h1>
          <p className="mt-3 text-surface-500 dark:text-surface-400">
            Track income, investments, loans & plan your FIRE journey — all private, all on your device.
          </p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => navigate('/onboarding')}
            className="group flex w-full items-center gap-4 rounded-2xl border border-surface-200 bg-white p-5 text-left shadow-sm transition hover:border-brand-300 hover:shadow-md dark:border-surface-700 dark:bg-surface-900 dark:hover:border-brand-700"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white dark:bg-brand-900/40 dark:text-brand-400">
              <UserPlus className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-semibold text-surface-900 dark:text-surface-50">
                Start as new user
              </span>
              <span className="text-sm text-surface-500">Guided setup for your finances</span>
            </span>
          </button>

          <button
            type="button"
            onClick={handleDemo}
            className="group flex w-full items-center gap-4 rounded-2xl border border-surface-200 bg-white p-5 text-left shadow-sm transition hover:border-brand-300 hover:shadow-md dark:border-surface-700 dark:bg-surface-900 dark:hover:border-brand-700"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-700 transition group-hover:bg-amber-600 group-hover:text-white dark:bg-amber-900/30 dark:text-amber-400">
              <Sparkles className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-semibold text-surface-900 dark:text-surface-50">
                Checkout demo
              </span>
              <span className="text-sm text-surface-500">
                Explore with a sample Bengaluru household (~₹18 LPA)
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group flex w-full items-center gap-4 rounded-2xl border border-surface-200 bg-white p-5 text-left shadow-sm transition hover:border-brand-300 hover:shadow-md dark:border-surface-700 dark:bg-surface-900 dark:hover:border-brand-700"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-100 text-surface-600 transition group-hover:bg-surface-800 group-hover:text-white dark:bg-surface-800 dark:text-surface-300">
              <Upload className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-semibold text-surface-900 dark:text-surface-50">
                Import my data
              </span>
              <span className="text-sm text-surface-500">Load a previously exported JSON backup</span>
            </span>
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImport} />
        </div>

        <div className="mt-8 flex items-center justify-center gap-6 text-xs text-surface-400">
          <span className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" /> No account needed
          </span>
          <span className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Data stays local
          </span>
        </div>

        <div className="mt-6 text-center">
          <Button variant="ghost" size="sm" onClick={() => navigate('/calculators')}>
            Or try calculators without setup →
          </Button>
        </div>
      </div>
    </div>
  )
}
