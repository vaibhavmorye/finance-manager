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
  ReferenceLine,
} from 'recharts'
import { ArrowLeft } from 'lucide-react'
import { Card, CardHeader, CardTitle, Input, StatCard } from '@/components/ui'
import { useFinanceStore } from '@/store/financeStore'
import { formatCurrency } from '@/lib/utils'
import { calculateFire } from '@/lib/finance/fire'
import { monthlyCashFlow, totalInvestedCorpus } from '@/lib/finance/networth'

export function FireCalculatorPage() {
  const store = useFinanceStore()
  const currency = store.profile.currency
  const cash = useMemo(() => monthlyCashFlow(store), [store])
  const corpus = useMemo(() => totalInvestedCorpus(store), [store])

  const [currentCorpus, setCurrentCorpus] = useState(String(corpus || 5000000))
  const [monthlySavings, setMonthlySavings] = useState(String(Math.max(0, cash.surplus) || 50000))
  const [annualExpenses, setAnnualExpenses] = useState(
    String(Math.max((cash.expenses + cash.insurance) * 12, 600000)),
  )
  const [returnPct, setReturnPct] = useState('10')
  const [inflation, setInflation] = useState('5')
  const [withdrawal, setWithdrawal] = useState('4')
  const [age, setAge] = useState(String(store.profile.age || 30))

  const result = useMemo(
    () =>
      calculateFire({
        currentCorpus: Number(currentCorpus) || 0,
        monthlySavings: Number(monthlySavings) || 0,
        expectedReturnPercent: Number(returnPct) || 0,
        inflationPercent: Number(inflation) || 0,
        withdrawalRatePercent: Number(withdrawal) || 4,
        currentAge: Number(age) || 30,
        annualExpenses: Number(annualExpenses) || 0,
      }),
    [currentCorpus, monthlySavings, returnPct, inflation, withdrawal, age, annualExpenses],
  )

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link to="/calculators" className="mb-2 inline-flex items-center gap-1 text-sm text-surface-500 hover:text-surface-700">
          <ArrowLeft className="h-3.5 w-3.5" /> Calculators
        </Link>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50">FIRE calculator</h1>
        <p className="text-sm text-surface-500">Plan your path to financial independence</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="space-y-3 lg:col-span-2">
          <Input label="Current corpus" type="number" value={currentCorpus} onChange={(e) => setCurrentCorpus(e.target.value)} />
          <Input label="Monthly savings" type="number" value={monthlySavings} onChange={(e) => setMonthlySavings(e.target.value)} />
          <Input label="Annual expenses" type="number" value={annualExpenses} onChange={(e) => setAnnualExpenses(e.target.value)} />
          <Input label="Current age" type="number" value={age} onChange={(e) => setAge(e.target.value)} />
          <Input label="Expected return %" type="number" value={returnPct} onChange={(e) => setReturnPct(e.target.value)} />
          <Input label="Inflation %" type="number" value={inflation} onChange={(e) => setInflation(e.target.value)} />
          <Input label="Withdrawal rate %" type="number" value={withdrawal} onChange={(e) => setWithdrawal(e.target.value)} hint="Classic 4% rule" />
        </Card>

        <div className="space-y-4 lg:col-span-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard
              label="FIRE number"
              value={formatCurrency(result.fireNumber, currency, { compact: true })}
            />
            <StatCard
              label="Years to FIRE"
              value={result.yearsToFire != null ? `${result.yearsToFire} yrs` : '—'}
              sub={result.fireAge != null ? `Age ${result.fireAge}` : 'Not within 50 years'}
            />
            <StatCard
              label="Coast FIRE corpus"
              value={formatCurrency(result.coastFireCorpus, currency, { compact: true })}
            />
            <StatCard
              label="Coast FIRE age"
              value={result.coastFireAge != null ? String(result.coastFireAge) : '—'}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Corpus projection (real terms)</CardTitle>
            </CardHeader>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={result.projection}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="age" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={60} />
                  <Tooltip
                    formatter={(v) => formatCurrency(Number(v ?? 0), currency, { compact: true })}
                    labelFormatter={(age) => `Age ${age}`}
                  />
                  <ReferenceLine
                    y={result.fireNumber}
                    stroke="#f43f5e"
                    strokeDasharray="4 4"
                    label={{ value: 'FIRE', fill: '#f43f5e', fontSize: 11 }}
                  />
                  <Area type="monotone" dataKey="corpus" stroke="#10b981" fill="#10b98133" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
