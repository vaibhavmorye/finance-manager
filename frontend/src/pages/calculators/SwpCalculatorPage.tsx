import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts'
import { ArrowLeft, Target } from 'lucide-react'
import { Card, CardHeader, CardTitle, Input, StatCard, Select, Button, Badge } from '@/components/ui'
import { CreatePotModal, type CreatePotDraft } from '@/components/CreatePotModal'
import { useFinanceStore } from '@/store/financeStore'
import { formatCurrency } from '@/lib/utils'
import { mfValue } from '@/lib/finance/networth'
import { calculateSwp, type SwpCalcMode } from '@/lib/finance/swp'

const modeOptions: { value: SwpCalcMode; label: string }[] = [
  { value: 'sustainability', label: 'Will my corpus last?' },
  { value: 'required_corpus', label: 'Corpus needed for income' },
]

export function SwpCalculatorPage() {
  const store = useFinanceStore()
  const currency = store.profile.currency
  const mfCorpus = useMemo(() => mfValue(store), [store])

  const [mode, setMode] = useState<SwpCalcMode>('sustainability')
  const [corpus, setCorpus] = useState(String(mfCorpus > 0 ? Math.round(mfCorpus) : 50_00_000))
  const [withdrawal, setWithdrawal] = useState('40000')
  const [returnPct, setReturnPct] = useState('8')
  const [years, setYears] = useState('25')
  const [stepUp, setStepUp] = useState('0')
  const [createOpen, setCreateOpen] = useState(false)

  const result = useMemo(
    () =>
      calculateSwp({
        mode,
        corpus: Number(corpus) || 0,
        monthlyWithdrawal: Number(withdrawal) || 0,
        annualReturnPercent: Number(returnPct) || 0,
        years: Number(years) || 0,
        annualStepUpPercent: Number(stepUp) || 0,
      }),
    [mode, corpus, withdrawal, returnPct, years, stepUp],
  )

  const planCorpus =
    mode === 'required_corpus' ? result.requiredCorpus : Number(corpus) || 0

  const draft: CreatePotDraft = useMemo(
    () => ({
      purpose: 'retirement',
      name: 'Retirement SWP',
      vehicle: 'mf',
      planMode: 'withdraw',
      targetAmount: planCorpus,
      currentAmount: planCorpus,
      monthlyAmount: Number(withdrawal) || 0,
      expectedReturnPercent: Number(returnPct) || 0,
      swpYears: Number(years) || 0,
      swpCorpus: planCorpus,
      mfCurrentValue: planCorpus,
      mfInvestedAmount: planCorpus,
      mfMonthlySip: 0,
      createHoldingDefault: true,
    }),
    [planCorpus, withdrawal, returnPct, years],
  )

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/calculators"
            className="mb-2 inline-flex items-center gap-1 text-sm text-surface-500 hover:text-surface-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Calculators
          </Link>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50">
            SWP calculator
          </h1>
          <p className="text-sm text-surface-500">
            Plan systematic withdrawals from a mutual-fund corpus — then create an MF pot &amp; plan
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Target className="h-4 w-4" /> Create MF pot &amp; plan
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="space-y-3 lg:col-span-2">
          <Select
            label="Mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as SwpCalcMode)}
            options={modeOptions}
          />
          {mode === 'sustainability' && (
            <>
              <Input
                label="Starting corpus"
                type="number"
                value={corpus}
                onChange={(e) => setCorpus(e.target.value)}
              />
              {mfCorpus > 0 && (
                <button
                  type="button"
                  className="text-left text-xs text-brand-600 hover:underline"
                  onClick={() => setCorpus(String(Math.round(mfCorpus)))}
                >
                  Use current MF corpus ({formatCurrency(mfCorpus, currency, { compact: true })})
                </button>
              )}
            </>
          )}
          <Input
            label="Monthly withdrawal"
            type="number"
            value={withdrawal}
            onChange={(e) => setWithdrawal(e.target.value)}
          />
          <Input
            label="Expected return %"
            type="number"
            value={returnPct}
            onChange={(e) => setReturnPct(e.target.value)}
          />
          <Input
            label="Duration (years)"
            type="number"
            value={years}
            onChange={(e) => setYears(e.target.value)}
          />
          <Input
            label="Annual step-up %"
            type="number"
            value={stepUp}
            onChange={(e) => setStepUp(e.target.value)}
            hint="Increase withdrawal each year"
          />
        </Card>

        <div className="space-y-4 lg:col-span-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant={result.sustainable ? 'success' : 'danger'}>
              {result.sustainable
                ? 'Lasts full term'
                : `Depletes in ~${result.monthsUntilDeplete} months`}
            </Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Required corpus"
              value={formatCurrency(result.requiredCorpus, currency, { compact: true })}
            />
            <StatCard
              label="Ending corpus"
              value={formatCurrency(result.endingCorpus, currency, { compact: true })}
            />
            <StatCard
              label="Total withdrawn"
              value={formatCurrency(result.totalWithdrawn, currency, { compact: true })}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Corpus over time</CardTitle>
            </CardHeader>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={result.projection}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={60} />
                  <Tooltip
                    formatter={(v) =>
                      formatCurrency(Number(v ?? 0), currency, { compact: true })
                    }
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="corpus"
                    name="Corpus"
                    stroke="#0ea5e9"
                    fill="#0ea5e955"
                  />
                  <Area
                    type="monotone"
                    dataKey="totalWithdrawn"
                    name="Withdrawn"
                    stroke="#f59e0b"
                    fill="#f59e0b33"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>

      <CreatePotModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        draft={draft}
        title="Create MF pot & plan"
      />
    </div>
  )
}
