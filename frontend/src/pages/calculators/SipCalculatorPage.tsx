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
import { ArrowLeft } from 'lucide-react'
import { Card, CardHeader, CardTitle, Input, StatCard } from '@/components/ui'
import { useFinanceStore } from '@/store/financeStore'
import { formatCurrency } from '@/lib/utils'
import { calculateSip } from '@/lib/finance/sip'
import { monthlySipTotal } from '@/lib/finance/networth'

export function SipCalculatorPage() {
  const store = useFinanceStore()
  const currency = store.profile.currency
  const defaultSip = monthlySipTotal(store) || 10000

  const [monthly, setMonthly] = useState(String(defaultSip))
  const [returnPct, setReturnPct] = useState('12')
  const [years, setYears] = useState('15')
  const [stepUp, setStepUp] = useState('0')

  const result = useMemo(
    () =>
      calculateSip({
        monthlyAmount: Number(monthly) || 0,
        annualReturnPercent: Number(returnPct) || 0,
        years: Number(years) || 0,
        stepUpPercent: Number(stepUp) || 0,
      }),
    [monthly, returnPct, years, stepUp],
  )

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link to="/calculators" className="mb-2 inline-flex items-center gap-1 text-sm text-surface-500 hover:text-surface-700">
          <ArrowLeft className="h-3.5 w-3.5" /> Calculators
        </Link>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50">SIP calculator</h1>
        <p className="text-sm text-surface-500">Project systematic investment plan growth</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="space-y-3 lg:col-span-2">
          <Input label="Monthly SIP" type="number" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
          <Input label="Expected return %" type="number" value={returnPct} onChange={(e) => setReturnPct(e.target.value)} />
          <Input label="Duration (years)" type="number" value={years} onChange={(e) => setYears(e.target.value)} />
          <Input
            label="Annual step-up %"
            type="number"
            value={stepUp}
            onChange={(e) => setStepUp(e.target.value)}
            hint="Increase SIP each year"
          />
        </Card>

        <div className="space-y-4 lg:col-span-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Future value"
              value={formatCurrency(result.futureValue, currency, { compact: true })}
            />
            <StatCard
              label="Invested"
              value={formatCurrency(result.totalInvested, currency, { compact: true })}
            />
            <StatCard
              label="Gains"
              value={formatCurrency(result.totalGains, currency, { compact: true })}
              trend="up"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Growth over time</CardTitle>
            </CardHeader>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={result.projection}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={60} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0), currency, { compact: true })} />
                  <Legend />
                  <Area type="monotone" dataKey="invested" name="Invested" stroke="#94a3b8" fill="#94a3b833" stackId="1" />
                  <Area type="monotone" dataKey="gains" name="Gains" stroke="#10b981" fill="#10b98155" stackId="1" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
