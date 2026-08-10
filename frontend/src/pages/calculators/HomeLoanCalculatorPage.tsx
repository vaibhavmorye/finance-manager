import { useMemo, useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { ArrowLeft } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, Input, Select, Tabs, StatCard } from '@/components/ui'
import { useFinanceStore } from '@/store/financeStore'
import { formatCurrency, formatMonths } from '@/lib/utils'
import {
  calculateEmi,
  generateAmortization,
  calculatePrepaymentPlan,
  type PrepaymentFrequency,
  type PrepaymentMode,
} from '@/lib/finance/loan'
import { createId } from '@/types/finance'

export function HomeLoanCalculatorPage() {
  const store = useFinanceStore()
  const currency = store.profile.currency
  const [params] = useSearchParams()
  const loanId = params.get('loanId')

  const existing = store.homeLoans.find((l) => l.id === loanId)

  const [principal, setPrincipal] = useState('5000000')
  const [rate, setRate] = useState('8.5')
  const [tenure, setTenure] = useState('240')
  const [startDate, setStartDate] = useState('2024-01-01')
  const [rateChangeDate, setRateChangeDate] = useState('')
  const [rateChangeValue, setRateChangeValue] = useState('')
  const [rateChanges, setRateChanges] = useState<{ date: string; interestRate: number }[]>([])

  const [extra, setExtra] = useState('10000')
  const [freq, setFreq] = useState<PrepaymentFrequency>('monthly')
  const [mode, setMode] = useState<PrepaymentMode>('reduce_tenure')
  const [view, setView] = useState('summary')

  useEffect(() => {
    if (!existing) return
    setPrincipal(String(existing.loanAmount))
    setRate(String(existing.interestRate))
    setTenure(String(existing.tenureMonths))
    setStartDate(existing.startDate)
    setRateChanges(existing.rateChanges.map((r) => ({ date: r.date, interestRate: r.interestRate })))
  }, [existing])

  const input = useMemo(
    () => ({
      principal: Number(principal) || 0,
      annualRate: Number(rate) || 0,
      tenureMonths: Number(tenure) || 0,
      startDate,
      rateChanges,
    }),
    [principal, rate, tenure, startDate, rateChanges],
  )

  const baseline = useMemo(() => generateAmortization(input), [input])
  const emi = useMemo(
    () => calculateEmi(input.principal, input.annualRate, input.tenureMonths),
    [input],
  )

  const prepay = useMemo(
    () =>
      calculatePrepaymentPlan({
        ...input,
        extraAmount: Number(extra) || 0,
        frequency: freq,
        mode,
      }),
    [input, extra, freq, mode],
  )

  const chartData = baseline.schedule
    .filter((_, i) => i % 6 === 0 || i === baseline.schedule.length - 1)
    .map((r) => ({
      month: r.month,
      balance: Math.round(r.balance),
      prepaid: prepay.withPrepayment.schedule[r.month - 1]
        ? Math.round(prepay.withPrepayment.schedule[r.month - 1].balance)
        : 0,
    }))

  const addRateChange = () => {
    if (!rateChangeDate || !rateChangeValue) return
    setRateChanges([
      ...rateChanges,
      { date: rateChangeDate, interestRate: Number(rateChangeValue) },
    ])
    setRateChangeDate('')
    setRateChangeValue('')
  }

  const saveRateToLoan = () => {
    if (!existing) return
    store.setHomeLoans(
      store.homeLoans.map((l) =>
        l.id === existing.id
          ? {
              ...l,
              rateChanges: rateChanges.map((r) => ({
                id: createId(),
                date: r.date,
                interestRate: r.interestRate,
              })),
            }
          : l,
      ),
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link to="/calculators" className="mb-2 inline-flex items-center gap-1 text-sm text-surface-500 hover:text-surface-700">
          <ArrowLeft className="h-3.5 w-3.5" /> Calculators
        </Link>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50">Home loan calculator</h1>
        <p className="text-sm text-surface-500">
          {existing ? `Using “${existing.name}”` : 'EMI, schedule & prepayment impact'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="space-y-3 lg:col-span-2">
          <h3 className="font-semibold">Loan inputs</h3>
          <Input label="Principal" type="number" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
          <Input label="Interest rate %" type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
          <Input label="Tenure (months)" type="number" value={tenure} onChange={(e) => setTenure(e.target.value)} />
          <Input label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />

          <div className="border-t border-surface-200 pt-3 dark:border-surface-700">
            <p className="mb-2 text-sm font-medium">Interest rate change</p>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={rateChangeDate} onChange={(e) => setRateChangeDate(e.target.value)} />
              <Input type="number" placeholder="New %" value={rateChangeValue} onChange={(e) => setRateChangeValue(e.target.value)} />
            </div>
            <Button className="mt-2 w-full" variant="secondary" size="sm" onClick={addRateChange}>
              Add rate change
            </Button>
            {rateChanges.map((r, i) => (
              <p key={i} className="mt-1 text-xs text-surface-500">
                {r.date} → {r.interestRate}%
              </p>
            ))}
            {existing && rateChanges.length > 0 && (
              <Button className="mt-2 w-full" variant="outline" size="sm" onClick={saveRateToLoan}>
                Save changes to loan
              </Button>
            )}
          </div>

          <div className="border-t border-surface-200 pt-3 dark:border-surface-700">
            <p className="mb-2 text-sm font-medium">Prepayment plan</p>
            <Input label="Extra payment" type="number" value={extra} onChange={(e) => setExtra(e.target.value)} />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Select
                label="Frequency"
                value={freq}
                onChange={(e) => setFreq(e.target.value as PrepaymentFrequency)}
                options={[
                  { value: 'monthly', label: 'Monthly' },
                  { value: 'quarterly', label: 'Quarterly' },
                  { value: 'half_yearly', label: 'Half-yearly' },
                  { value: 'annually', label: 'Annually' },
                  { value: 'weekly', label: 'Weekly' },
                  { value: 'one_time', label: 'One-time' },
                ]}
              />
              <Select
                label="Mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as PrepaymentMode)}
                options={[
                  { value: 'reduce_tenure', label: 'Reduce tenure' },
                  { value: 'reduce_emi', label: 'Reduce EMI' },
                ]}
              />
            </div>
          </div>
        </Card>

        <div className="space-y-4 lg:col-span-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="EMI" value={formatCurrency(emi, currency)} />
            <StatCard
              label="Total interest"
              value={formatCurrency(baseline.totalInterest, currency, { compact: true })}
            />
            <StatCard
              label="Interest saved"
              value={formatCurrency(prepay.interestSaved, currency, { compact: true })}
              trend="up"
              sub="With prepayment plan"
            />
            <StatCard
              label="Time saved"
              value={formatMonths(Math.max(0, prepay.monthsSaved))}
              trend="up"
              sub={mode === 'reduce_emi' ? `New EMI ~ ${formatCurrency(prepay.newEmi, currency)}` : undefined}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Balance over time</CardTitle>
              <Tabs
                tabs={[
                  { id: 'summary', label: 'Chart' },
                  { id: 'schedule', label: 'Schedule' },
                ]}
                active={view}
                onChange={setView}
              />
            </CardHeader>
            {view === 'summary' ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={60} />
                    <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0), currency, { compact: true })} />
                    <Area type="monotone" dataKey="balance" name="Without prepay" stroke="#94a3b8" fill="#94a3b833" />
                    <Area type="monotone" dataKey="prepaid" name="With prepay" stroke="#10b981" fill="#10b98133" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="max-h-72 overflow-auto scrollbar-thin">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-white dark:bg-surface-900">
                    <tr className="border-b border-surface-200 dark:border-surface-700">
                      <th className="py-2 pr-2">#</th>
                      <th className="py-2 pr-2">Date</th>
                      <th className="py-2 pr-2">EMI</th>
                      <th className="py-2 pr-2">Interest</th>
                      <th className="py-2 pr-2">Principal</th>
                      <th className="py-2">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {baseline.schedule.slice(0, 60).map((r) => (
                      <tr key={r.month} className="border-b border-surface-100 dark:border-surface-800">
                        <td className="py-1.5 pr-2 font-mono">{r.month}</td>
                        <td className="py-1.5 pr-2">{r.date}</td>
                        <td className="py-1.5 pr-2 font-mono">{Math.round(r.emi).toLocaleString()}</td>
                        <td className="py-1.5 pr-2 font-mono">{Math.round(r.interest).toLocaleString()}</td>
                        <td className="py-1.5 pr-2 font-mono">{Math.round(r.principal).toLocaleString()}</td>
                        <td className="py-1.5 font-mono">{Math.round(r.balance).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {baseline.schedule.length > 60 && (
                  <p className="mt-2 text-xs text-surface-400">Showing first 60 of {baseline.schedule.length} months</p>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
