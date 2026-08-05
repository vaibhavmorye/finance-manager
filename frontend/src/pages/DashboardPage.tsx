import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts'
import { Wallet, TrendingUp, Landmark, PiggyBank, ArrowRight } from 'lucide-react'
import { StatCard, Card, CardHeader, CardTitle, CardDescription, Badge } from '@/components/ui'
import { useFinanceStore } from '@/store/financeStore'
import { formatCurrency, formatPercent } from '@/lib/utils'
import {
  calculateNetWorth,
  monthlyCashFlow,
  totalInvestedCorpus,
} from '@/lib/finance/networth'
import { calculateFire } from '@/lib/finance/fire'

const COLORS = ['#10b981', '#0ea5e9', '#8b5cf6', '#f59e0b']

export function DashboardPage() {
  const store = useFinanceStore()
  const currency = store.profile.currency

  const nw = useMemo(() => calculateNetWorth(store), [store])
  const cash = useMemo(() => monthlyCashFlow(store), [store])
  const corpus = useMemo(() => totalInvestedCorpus(store), [store])

  const fire = useMemo(
    () =>
      calculateFire({
        currentCorpus: corpus,
        monthlySavings: Math.max(0, cash.surplus),
        expectedReturnPercent: 10,
        inflationPercent: 5,
        withdrawalRatePercent: 4,
        currentAge: store.profile.age,
        annualExpenses: (cash.expenses + cash.insurance) * 12,
      }),
    [corpus, cash, store.profile.age],
  )

  const allocation = [
    { name: 'Stocks', value: nw.stocks },
    { name: 'Mutual funds', value: nw.mutualFunds },
    { name: 'FDs', value: nw.fixedDeposits },
    { name: 'Property equity', value: Math.max(0, nw.propertyEquity) },
  ].filter((d) => d.value > 0)

  const cashFlowData = [
    { name: 'Income', amount: cash.income },
    { name: 'Expenses', amount: cash.expenses },
    { name: 'EMIs', amount: cash.emis },
    { name: 'Insurance', amount: cash.insurance },
    { name: 'SIPs', amount: cash.sips },
  ]

  const fireProgress =
    fire.fireNumber > 0 ? Math.min(100, (corpus / fire.fireNumber) * 100) : 0

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50">
          {store.profile.name ? `Welcome back, ${store.profile.name}` : 'Dashboard'}
        </h1>
        <p className="mt-1 text-sm text-surface-500">Your financial snapshot at a glance</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Net worth"
          value={formatCurrency(nw.netWorth, currency, { compact: true })}
          sub={`Assets ${formatCurrency(nw.totalAssets, currency, { compact: true })}`}
          icon={<Wallet className="h-4 w-4" />}
          trend={nw.netWorth >= 0 ? 'up' : 'down'}
        />
        <StatCard
          label="Monthly surplus"
          value={formatCurrency(cash.surplus, currency, { compact: true })}
          sub={`Savings rate ${formatPercent(cash.savingsRate)}`}
          icon={<PiggyBank className="h-4 w-4" />}
          trend={cash.surplus >= 0 ? 'up' : 'down'}
        />
        <StatCard
          label="Invested corpus"
          value={formatCurrency(corpus, currency, { compact: true })}
          sub="Stocks + MF + FD"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Liabilities"
          value={formatCurrency(nw.totalLiabilities, currency, { compact: true })}
          sub="Loans outstanding"
          icon={<Landmark className="h-4 w-4" />}
          trend="down"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Asset allocation</CardTitle>
              <CardDescription>Where your money sits</CardDescription>
            </div>
          </CardHeader>
          {allocation.length === 0 ? (
            <p className="py-8 text-center text-sm text-surface-400">Add investments to see allocation</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocation}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {allocation.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => formatCurrency(Number(v ?? 0), currency, { compact: true })}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Monthly cash flow</CardTitle>
              <CardDescription>Income vs outflows</CardDescription>
            </div>
          </CardHeader>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlowData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={50} />
                <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0), currency)} />
                <Bar dataKey="amount" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>FIRE progress</CardTitle>
            <CardDescription>
              Target corpus {formatCurrency(fire.fireNumber, currency, { compact: true })}
              {fire.yearsToFire != null && ` · ~${fire.yearsToFire} years away`}
            </CardDescription>
          </div>
          <Link
            to="/calculators/fire"
            className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Open calculator <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <div className="h-3 overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-700"
            style={{ width: `${fireProgress}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="success">{formatPercent(fireProgress, 0)} funded</Badge>
          {fire.coastFireAge != null && (
            <Badge variant="info">Coast FIRE age ~{fire.coastFireAge}</Badge>
          )}
        </div>
      </Card>
    </div>
  )
}
