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
import { Card, CardHeader, CardTitle, Input, StatCard, Checkbox, Badge } from '@/components/ui'
import { useFinanceStore } from '@/store/financeStore'
import { formatCurrency } from '@/lib/utils'
import { calculateSip } from '@/lib/finance/sip'
import { monthlySipTotal, mfValue } from '@/lib/finance/networth'

export function SipCalculatorPage() {
  const store = useFinanceStore()
  const currency = store.profile.currency

  const runningSips = useMemo(
    () => store.mutualFunds.filter((m) => m.monthlySip > 0),
    [store.mutualFunds],
  )
  const runningSipTotal = useMemo(() => monthlySipTotal(store), [store])
  const mfCorpus = useMemo(() => mfValue(store), [store])
  const mfInvested = useMemo(
    () => store.mutualFunds.reduce((s, m) => s + m.investedAmount, 0),
    [store.mutualFunds],
  )
  const hasRunningSips = runningSipTotal > 0

  const [includeRunning, setIncludeRunning] = useState(hasRunningSips)
  const [extraMonthly, setExtraMonthly] = useState('0')
  const [manualMonthly, setManualMonthly] = useState(
    String(hasRunningSips ? runningSipTotal : 10000),
  )
  const [returnPct, setReturnPct] = useState('12')
  const [years, setYears] = useState('15')
  const [stepUp, setStepUp] = useState('0')

  const effectiveMonthly = includeRunning
    ? runningSipTotal + (Number(extraMonthly) || 0)
    : Number(manualMonthly) || 0

  const result = useMemo(
    () =>
      calculateSip({
        monthlyAmount: effectiveMonthly,
        annualReturnPercent: Number(returnPct) || 0,
        years: Number(years) || 0,
        stepUpPercent: Number(stepUp) || 0,
        existingCorpus: includeRunning ? mfCorpus : 0,
        existingInvested: includeRunning ? mfInvested : 0,
      }),
    [effectiveMonthly, returnPct, years, stepUp, includeRunning, mfCorpus, mfInvested],
  )

  const toggleInclude = (checked: boolean) => {
    setIncludeRunning(checked)
    if (!checked && hasRunningSips) {
      setManualMonthly(String(runningSipTotal))
    }
  }

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
          <Checkbox
            label="Include current running SIPs"
            description={
              hasRunningSips
                ? `${runningSips.length} fund(s) · ${formatCurrency(runningSipTotal, currency)}/mo · corpus ${formatCurrency(mfCorpus, currency, { compact: true })}`
                : 'No monthly SIPs on your mutual funds yet — add them under Investments'
            }
            checked={includeRunning && hasRunningSips}
            onChange={toggleInclude}
            disabled={!hasRunningSips}
          />

          {includeRunning && hasRunningSips && (
            <div className="space-y-2 rounded-xl border border-surface-200 p-3 dark:border-surface-700">
              <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Your SIPs</p>
              <ul className="space-y-1.5">
                {runningSips.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-surface-700 dark:text-surface-200">{m.name}</span>
                    <span className="shrink-0 font-mono text-surface-900 dark:text-surface-50">
                      {formatCurrency(m.monthlySip, currency)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between border-t border-surface-200 pt-2 text-sm font-medium dark:border-surface-700">
                <span>Total SIP</span>
                <span className="font-mono">{formatCurrency(runningSipTotal, currency)}/mo</span>
              </div>
              <Input
                label="Additional SIP (optional)"
                type="number"
                value={extraMonthly}
                onChange={(e) => setExtraMonthly(e.target.value)}
                hint="Extra amount on top of current SIPs"
              />
            </div>
          )}

          {!(includeRunning && hasRunningSips) && (
            <Input
              label="Monthly SIP"
              type="number"
              value={manualMonthly}
              onChange={(e) => setManualMonthly(e.target.value)}
            />
          )}

          {(includeRunning && hasRunningSips) && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">
                Effective SIP {formatCurrency(effectiveMonthly, currency)}/mo
              </Badge>
              <Badge variant="info">
                Starts from {formatCurrency(mfCorpus, currency, { compact: true })}
              </Badge>
            </div>
          )}

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
              label="Total invested"
              value={formatCurrency(result.totalInvested, currency, { compact: true })}
              sub={includeRunning && hasRunningSips ? 'Includes amount already invested' : undefined}
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
