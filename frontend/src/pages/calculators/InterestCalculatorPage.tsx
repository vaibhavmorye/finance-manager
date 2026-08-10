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
import { ArrowLeft, PiggyBank } from 'lucide-react'
import { Card, CardHeader, CardTitle, Input, StatCard, Select, Button } from '@/components/ui'
import { CreatePotModal, type CreatePotDraft } from '@/components/CreatePotModal'
import { useFinanceStore } from '@/store/financeStore'
import { formatCurrency } from '@/lib/utils'
import {
  calculateInterest,
  addMonthsIso,
  todayIso,
  type CompoundingFrequency,
  type InterestCalcMode,
} from '@/lib/finance/interest'

const compoundingOptions: { value: CompoundingFrequency; label: string }[] = [
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'simple', label: 'Simple' },
]

const modeOptions: { value: InterestCalcMode; label: string }[] = [
  { value: 'maturity', label: 'Maturity from principal' },
  { value: 'required_principal', label: 'Principal for a target' },
  { value: 'recurring', label: 'Recurring deposits' },
]

export function InterestCalculatorPage() {
  const currency = useFinanceStore((s) => s.profile.currency)

  const [mode, setMode] = useState<InterestCalcMode>('maturity')
  const [principal, setPrincipal] = useState('500000')
  const [target, setTarget] = useState('1000000')
  const [rate, setRate] = useState('6.5')
  const [years, setYears] = useState('3')
  const [months, setMonths] = useState('0')
  const [compounding, setCompounding] = useState<CompoundingFrequency>('quarterly')
  const [monthlyDeposit, setMonthlyDeposit] = useState('10000')
  const [createOpen, setCreateOpen] = useState(false)

  const result = useMemo(
    () =>
      calculateInterest({
        mode,
        principal: Number(principal) || 0,
        targetMaturity: Number(target) || 0,
        annualRatePercent: Number(rate) || 0,
        years: Number(years) || 0,
        months: Number(months) || 0,
        compounding,
        monthlyDeposit: Number(monthlyDeposit) || 0,
      }),
    [mode, principal, target, rate, years, months, compounding, monthlyDeposit],
  )

  const draft: CreatePotDraft = useMemo(() => {
    const start = todayIso()
    const maturity = addMonthsIso(start, result.tenureMonths)
    const fdPrincipal =
      mode === 'required_principal'
        ? result.requiredPrincipal ?? 0
        : mode === 'recurring'
          ? result.totalInvested
          : Number(principal) || 0
    return {
      purpose: 'emergency',
      name: 'Emergency fund',
      vehicle: 'fd',
      planMode: 'accumulate',
      targetAmount: result.maturityValue,
      targetDate: maturity,
      currentAmount: mode === 'recurring' ? Number(principal) || 0 : fdPrincipal,
      monthlyAmount: mode === 'recurring' ? Number(monthlyDeposit) || 0 : 0,
      expectedReturnPercent: Number(rate) || 0,
      fdPrincipal,
      fdInterestRate: Number(rate) || 0,
      fdStartDate: start,
      fdMaturityDate: maturity,
      createHoldingDefault: true,
    }
  }, [result, mode, principal, monthlyDeposit, rate])

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
            Interest calculator
          </h1>
          <p className="text-sm text-surface-500">
            FD / deposit maturity, required principal, or recurring savings — then create an FD pot
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <PiggyBank className="h-4 w-4" /> Create FD pot
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="space-y-3 lg:col-span-2">
          <Select
            label="Mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as InterestCalcMode)}
            options={modeOptions}
          />
          {mode !== 'required_principal' && (
            <Input
              label={mode === 'recurring' ? 'Starting principal (optional)' : 'Principal'}
              type="number"
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
            />
          )}
          {mode === 'required_principal' && (
            <Input
              label="Target maturity value"
              type="number"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          )}
          {mode === 'recurring' && (
            <Input
              label="Monthly deposit"
              type="number"
              value={monthlyDeposit}
              onChange={(e) => setMonthlyDeposit(e.target.value)}
            />
          )}
          <Input
            label="Interest rate % p.a."
            type="number"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Years"
              type="number"
              value={years}
              onChange={(e) => setYears(e.target.value)}
            />
            <Input
              label="Months"
              type="number"
              value={months}
              onChange={(e) => setMonths(e.target.value)}
            />
          </div>
          <Select
            label="Compounding"
            value={compounding}
            onChange={(e) => setCompounding(e.target.value as CompoundingFrequency)}
            options={compoundingOptions}
          />
        </Card>

        <div className="space-y-4 lg:col-span-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label={mode === 'required_principal' ? 'Principal needed' : 'Maturity value'}
              value={formatCurrency(
                mode === 'required_principal'
                  ? result.requiredPrincipal ?? 0
                  : result.maturityValue,
                currency,
                { compact: true },
              )}
            />
            <StatCard
              label="Interest earned"
              value={formatCurrency(result.interestEarned, currency, { compact: true })}
              trend="up"
            />
            <StatCard
              label="Effective yield"
              value={`${result.effectiveAnnualYieldPercent.toFixed(2)}%`}
              sub={`${result.tenureMonths} months`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Balance over time</CardTitle>
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
                    dataKey="invested"
                    name="Invested"
                    stroke="#94a3b8"
                    fill="#94a3b833"
                    stackId="1"
                  />
                  <Area
                    type="monotone"
                    dataKey="interest"
                    name="Interest"
                    stroke="#10b981"
                    fill="#10b98155"
                    stackId="1"
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
        title="Create FD saving pot"
      />
    </div>
  )
}
