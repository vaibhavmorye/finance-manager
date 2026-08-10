import { Link } from 'react-router-dom'
import { Landmark, Flame, Repeat, Percent, ArrowDownToLine } from 'lucide-react'
import { Card } from '@/components/ui'

const calculators = [
  {
    to: '/calculators/home-loan',
    title: 'Home loan calculator',
    description: 'EMI, amortization, rate changes & prepayment planner (monthly / weekly).',
    icon: Landmark,
    color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },
  {
    to: '/calculators/fire',
    title: 'FIRE calculator',
    description: 'Financial independence number, years to FIRE, and coast FIRE age.',
    icon: Flame,
    color: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  },
  {
    to: '/calculators/sip',
    title: 'SIP calculator',
    description: 'Project SIP growth with step-up — optionally create an MF accumulate pot.',
    icon: Repeat,
    color: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  },
  {
    to: '/calculators/swp',
    title: 'SWP calculator',
    description: 'Systematic withdrawal plan — create a retirement MF pot & plan from results.',
    icon: ArrowDownToLine,
    color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  {
    to: '/calculators/interest',
    title: 'Interest calculator',
    description: 'FD maturity, required principal, or recurring deposits — create an FD goal pot.',
    icon: Percent,
    color: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  },
]

export function CalculatorsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50">Calculators</h1>
        <p className="text-sm text-surface-500">Standalone tools — pre-filled from your data when available</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {calculators.map((c) => (
          <Link key={c.to} to={c.to}>
            <Card className="h-full transition hover:border-brand-300 hover:shadow-md dark:hover:border-brand-700">
              <span className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl ${c.color}`}>
                <c.icon className="h-5 w-5" />
              </span>
              <h3 className="font-semibold text-surface-900 dark:text-surface-50">{c.title}</h3>
              <p className="mt-1 text-sm text-surface-500">{c.description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
