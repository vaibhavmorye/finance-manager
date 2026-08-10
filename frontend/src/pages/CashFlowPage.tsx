import { useMemo, useState } from 'react'
import {
  Plus,
  Trash2,
  Pencil,
  CalendarPlus,
  Wallet,
  ShoppingCart,
  TrendingUp,
  PiggyBank,
  Landmark,
  Shield,
} from 'lucide-react'
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
  AreaChart,
  Area,
  CartesianGrid,
} from 'recharts'
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Select,
  EmptyState,
  Modal,
  StatCard,
  Tabs,
  Badge,
} from '@/components/ui'
import { useFinanceStore } from '@/store/financeStore'
import { formatCurrency, formatPercent, cn } from '@/lib/utils'
import {
  createId,
  EXPENSE_CATEGORY_LABELS,
  type ExpenseCategory,
  type ExpenseEntry,
  type MonthlyExpense,
} from '@/types/finance'
import {
  applyBudgetToMonth,
  budgetVsActual,
  categoryBreakdown,
  entriesInMonth,
  entriesInYear,
  monthRange,
  monthlyBudgetTotal,
  monthlyTrend,
  periodInvestmentOutflow,
  periodSummary,
  yearMonth,
  yearRange,
  type PeriodMode,
} from '@/lib/finance/cashflow'

const PIE_COLORS = [
  '#10b981',
  '#0ea5e9',
  '#8b5cf6',
  '#f59e0b',
  '#f43f5e',
  '#14b8a6',
  '#6366f1',
  '#ec4899',
  '#84cc16',
  '#64748b',
]

const CATEGORY_OPTIONS = Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => ({
  value,
  label,
}))

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function currentYm(): string {
  return yearMonth(new Date())
}

export function CashFlowPage() {
  const store = useFinanceStore()
  const currency = store.profile.currency
  const expenses = store.expenses
  const expenseEntries = store.expenseEntries ?? []

  const [mode, setMode] = useState<PeriodMode>('month')
  const [ym, setYm] = useState(currentYm)
  const [year, setYear] = useState(new Date().getFullYear())
  const [tab, setTab] = useState('overview')

  const [budgetModal, setBudgetModal] = useState(false)
  const [editingBudget, setEditingBudget] = useState<MonthlyExpense | null>(null)
  const [budgetForm, setBudgetForm] = useState({
    category: 'groceries' as ExpenseCategory,
    name: '',
    amount: '',
  })

  const [entryModal, setEntryModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState<ExpenseEntry | null>(null)
  const [entryForm, setEntryForm] = useState({
    category: 'groceries' as ExpenseCategory,
    name: '',
    amount: '',
    date: todayIso(),
    notes: '',
  })

  const range = useMemo(
    () => (mode === 'year' ? yearRange(year) : monthRange(ym)),
    [mode, year, ym],
  )

  const periodEntries = useMemo(
    () => (mode === 'year' ? entriesInYear(expenseEntries, year) : entriesInMonth(expenseEntries, ym)),
    [expenseEntries, mode, year, ym],
  )

  const summary = useMemo(
    () => periodSummary(store, mode, { yearMonth: ym, year }),
    [store, mode, ym, year],
  )

  const investment = useMemo(
    () => periodInvestmentOutflow(store, range),
    [store, range],
  )

  const monthsInPeriod = mode === 'year' ? 12 : 1

  const breakdownSource = periodEntries.length > 0 ? periodEntries : expenses.map((e) => ({
    ...e,
    amount: e.amount * monthsInPeriod,
  }))

  const pieData = useMemo(() => categoryBreakdown(breakdownSource), [breakdownSource])

  const vsActual = useMemo(
    () => budgetVsActual(expenses, periodEntries, monthsInPeriod),
    [expenses, periodEntries, monthsInPeriod],
  )

  const trend = useMemo(
    () => monthlyTrend(expenseEntries, expenses, mode === 'year' ? `${year}-12` : ym, 12),
    [expenseEntries, expenses, mode, year, ym],
  )

  const outflowBar = [
    { name: 'Spend', amount: summary.spend },
    { name: 'EMIs', amount: summary.emis },
    { name: 'Insurance', amount: summary.insurance },
    { name: 'Invest', amount: summary.investments },
  ]

  const budgetMonthly = monthlyBudgetTotal(expenses)

  const entriesByDay = useMemo(() => {
    const map = new Map<string, ExpenseEntry[]>()
    const sorted = [...periodEntries].sort((a, b) => b.date.localeCompare(a.date))
    for (const e of sorted) {
      const list = map.get(e.date) ?? []
      list.push(e)
      map.set(e.date, list)
    }
    return [...map.entries()]
  }, [periodEntries])

  const openAddBudget = () => {
    setEditingBudget(null)
    setBudgetForm({ category: 'groceries', name: '', amount: '' })
    setBudgetModal(true)
  }

  const openEditBudget = (b: MonthlyExpense) => {
    setEditingBudget(b)
    setBudgetForm({
      category: b.category,
      name: b.name,
      amount: String(b.amount),
    })
    setBudgetModal(true)
  }

  const saveBudget = () => {
    if (!budgetForm.amount) return
    const row: MonthlyExpense = {
      id: editingBudget?.id ?? createId(),
      category: budgetForm.category,
      name: budgetForm.name || EXPENSE_CATEGORY_LABELS[budgetForm.category],
      amount: Number(budgetForm.amount),
    }
    if (editingBudget) {
      store.setExpenses(expenses.map((e) => (e.id === editingBudget.id ? row : e)))
    } else {
      store.setExpenses([...expenses, row])
    }
    setBudgetModal(false)
  }

  const openAddEntry = () => {
    setEditingEntry(null)
    const defaultDate = mode === 'month' ? `${ym}-01` : todayIso()
    setEntryForm({
      category: 'groceries',
      name: '',
      amount: '',
      date: defaultDate <= todayIso() ? defaultDate : todayIso(),
      notes: '',
    })
    setEntryModal(true)
  }

  const openEditEntry = (e: ExpenseEntry) => {
    setEditingEntry(e)
    setEntryForm({
      category: e.category,
      name: e.name,
      amount: String(e.amount),
      date: e.date,
      notes: e.notes ?? '',
    })
    setEntryModal(true)
  }

  const saveEntry = () => {
    if (!entryForm.amount || !entryForm.date) return
    const row: ExpenseEntry = {
      id: editingEntry?.id ?? createId(),
      category: entryForm.category,
      name: entryForm.name || EXPENSE_CATEGORY_LABELS[entryForm.category],
      amount: Number(entryForm.amount),
      date: entryForm.date,
      ...(entryForm.notes.trim() ? { notes: entryForm.notes.trim() } : {}),
    }
    if (editingEntry) {
      store.setExpenseEntries(expenseEntries.map((e) => (e.id === editingEntry.id ? row : e)))
    } else {
      store.setExpenseEntries([...expenseEntries, row])
    }
    setEntryModal(false)
  }

  const applyBudget = () => {
    if (mode !== 'month') return
    const { entries, added } = applyBudgetToMonth(expenses, expenseEntries, ym, createId)
    if (added === 0) return
    store.setExpenseEntries(entries)
  }

  const periodLabel =
    mode === 'month'
      ? new Date(`${ym}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : String(year)

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50">Cash flow</h1>
          <p className="mt-1 text-sm text-surface-500">
            Budgets, spend, and investments for {periodLabel}
            {!summary.spendFromEntries && periodEntries.length === 0 && expenses.length > 0
              ? ' · showing planned budget'
              : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            tabs={[
              { id: 'month', label: 'Monthly' },
              { id: 'year', label: 'Yearly' },
            ]}
            active={mode}
            onChange={(id) => setMode(id as PeriodMode)}
          />
          {mode === 'month' ? (
            <Input
              type="month"
              value={ym}
              onChange={(e) => setYm(e.target.value || currentYm())}
              className="w-[10.5rem]"
            />
          ) : (
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())}
              className="w-24"
              min={2000}
              max={2100}
            />
          )}
          {mode === 'month' && expenses.length > 0 && (
            <Button variant="secondary" onClick={applyBudget}>
              <CalendarPlus className="h-4 w-4" /> Apply budget
            </Button>
          )}
          <Button onClick={openAddEntry}>
            <Plus className="h-4 w-4" /> Log expense
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Income"
          value={formatCurrency(summary.income, currency, { compact: true })}
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          label="Spend"
          value={formatCurrency(summary.spend, currency, { compact: true })}
          sub={summary.spendFromEntries ? 'From ledger' : 'From budget'}
          icon={<ShoppingCart className="h-4 w-4" />}
        />
        <StatCard
          label="Invested"
          value={formatCurrency(summary.investments, currency, { compact: true })}
          sub={`SIPs + equity buys`}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Surplus"
          value={formatCurrency(summary.surplus, currency, { compact: true })}
          icon={<PiggyBank className="h-4 w-4" />}
          trend={summary.surplus >= 0 ? 'up' : 'down'}
        />
        <StatCard
          label="Savings rate"
          value={formatPercent(summary.savingsRate)}
          sub="Before investments"
          icon={<Landmark className="h-4 w-4" />}
          trend={summary.savingsRate >= 0 ? 'up' : 'down'}
        />
      </div>

      <Tabs
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'budgets', label: 'Budgets' },
          { id: 'ledger', label: 'Ledger' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Spend by category</CardTitle>
                  <CardDescription>
                    {summary.spendFromEntries ? 'Actual ledger' : 'Planned budget'}
                  </CardDescription>
                </div>
              </CardHeader>
              {pieData.length === 0 ? (
                <p className="py-8 text-center text-sm text-surface-400">
                  Add a budget or log expenses to see categories
                </p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="amount"
                        nameKey="label"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
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
                  <CardTitle>Outflows</CardTitle>
                  <CardDescription>Spend, EMIs, insurance, investments</CardDescription>
                </div>
              </CardHeader>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={outflowBar}>
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
                <CardTitle>Budget vs actual</CardTitle>
                <CardDescription>
                  {mode === 'year' ? 'Yearly budget (= monthly × 12)' : 'This month'}
                </CardDescription>
              </div>
            </CardHeader>
            {vsActual.length === 0 ? (
              <p className="py-6 text-center text-sm text-surface-400">No budget or spend yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-surface-200 text-xs text-surface-400 dark:border-surface-700">
                      <th className="pb-2 font-medium">Category</th>
                      <th className="pb-2 text-right font-medium">Budget</th>
                      <th className="pb-2 text-right font-medium">Actual</th>
                      <th className="pb-2 text-right font-medium">Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vsActual.map((row) => (
                      <tr
                        key={row.category}
                        className="border-b border-surface-100 last:border-0 dark:border-surface-800"
                      >
                        <td className="py-2.5 text-surface-800 dark:text-surface-100">{row.label}</td>
                        <td className="py-2.5 text-right font-mono text-surface-600 dark:text-surface-300">
                          {formatCurrency(row.budget, currency)}
                        </td>
                        <td className="py-2.5 text-right font-mono text-surface-600 dark:text-surface-300">
                          {formatCurrency(row.actual, currency)}
                        </td>
                        <td
                          className={cn(
                            'py-2.5 text-right font-mono',
                            row.variance > 0
                              ? 'text-accent-rose'
                              : row.variance < 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-surface-500',
                          )}
                        >
                          {row.variance > 0 ? '+' : ''}
                          {formatCurrency(row.variance, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>12-month spend trend</CardTitle>
                <CardDescription>Actual ledger vs monthly budget</CardDescription>
              </div>
            </CardHeader>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-surface-200 dark:stroke-surface-700" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} width={50} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0), currency)} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="actual"
                    name="Actual"
                    stroke="#10b981"
                    fill="#10b98133"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="budget"
                    name="Budget"
                    stroke="#94a3b8"
                    fill="transparent"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Invested this period</CardTitle>
                <CardDescription>
                  SIPs {formatCurrency(investment.sips, currency)} · Equity buys{' '}
                  {formatCurrency(investment.equityBuys, currency)}
                </CardDescription>
              </div>
              <Badge variant="info">{formatCurrency(investment.total, currency, { compact: true })}</Badge>
            </CardHeader>
            {investment.buyTrades.length === 0 && investment.sips === 0 ? (
              <p className="py-4 text-sm text-surface-400">No SIPs or equity buys in this period</p>
            ) : (
              <div className="space-y-2">
                {investment.sips > 0 && (
                  <div className="flex items-center justify-between rounded-lg bg-surface-50 px-3 py-2 dark:bg-surface-800/60">
                    <div className="flex items-center gap-2 text-sm">
                      <Shield className="h-4 w-4 text-surface-400" />
                      Mutual fund SIPs
                    </div>
                    <span className="font-mono text-sm font-semibold">
                      {formatCurrency(investment.sips, currency)}
                    </span>
                  </div>
                )}
                {investment.buyTrades.slice(0, 8).map((t, i) => (
                  <div
                    key={`${t.symbol}-${t.date}-${i}`}
                    className="flex items-center justify-between rounded-lg bg-surface-50 px-3 py-2 dark:bg-surface-800/60"
                  >
                    <div>
                      <p className="text-sm font-medium">{t.symbol}</p>
                      <p className="text-xs text-surface-400">{t.date}</p>
                    </div>
                    <span className="font-mono text-sm font-semibold">
                      {formatCurrency(t.amount, currency)}
                    </span>
                  </div>
                ))}
                {investment.buyTrades.length > 8 && (
                  <p className="text-xs text-surface-400">
                    +{investment.buyTrades.length - 8} more buys
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === 'budgets' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-surface-500">
              Monthly {formatCurrency(budgetMonthly, currency)} · Yearly{' '}
              {formatCurrency(budgetMonthly * 12, currency)}
            </p>
            <Button onClick={openAddBudget}>
              <Plus className="h-4 w-4" /> Add budget
            </Button>
          </div>
          {expenses.length === 0 ? (
            <EmptyState
              title="No monthly budgets"
              description="Add recurring lines like rent, groceries, and subscriptions."
              actionLabel="Add budget"
              onAction={openAddBudget}
            />
          ) : (
            <div className="space-y-2">
              {expenses.map((e) => (
                <Card key={e.id} className="flex items-center justify-between !p-4">
                  <div>
                    <p className="font-medium text-surface-900 dark:text-surface-50">{e.name}</p>
                    <p className="text-xs text-surface-400">
                      {EXPENSE_CATEGORY_LABELS[e.category]} ·{' '}
                      {formatCurrency(e.amount * 12, currency)} / yr
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="mr-2 font-mono text-sm font-semibold">
                      {formatCurrency(e.amount, currency)}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => openEditBudget(e)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => store.setExpenses(expenses.filter((x) => x.id !== e.id))}
                    >
                      <Trash2 className="h-4 w-4 text-accent-rose" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'ledger' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-surface-500">
              {periodEntries.length} entries · {formatCurrency(summary.spendFromEntries ? summary.spend : 0, currency)}
            </p>
            <div className="flex gap-2">
              {mode === 'month' && expenses.length > 0 && (
                <Button variant="secondary" onClick={applyBudget}>
                  <CalendarPlus className="h-4 w-4" /> Apply budget
                </Button>
              )}
              <Button onClick={openAddEntry}>
                <Plus className="h-4 w-4" /> Log expense
              </Button>
            </div>
          </div>
          {periodEntries.length === 0 ? (
            <EmptyState
              title="No expenses logged"
              description={
                expenses.length > 0 && mode === 'month'
                  ? 'Apply your monthly budget or log individual expenses.'
                  : 'Log dated spend to track monthly and yearly trends.'
              }
              actionLabel={expenses.length > 0 && mode === 'month' ? 'Apply budget' : 'Log expense'}
              onAction={expenses.length > 0 && mode === 'month' ? applyBudget : openAddEntry}
            />
          ) : (
            <div className="space-y-4">
              {entriesByDay.map(([date, dayEntries]) => (
                <div key={date} className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-surface-400">
                    {new Date(date + 'T12:00:00').toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                  {dayEntries.map((e) => (
                    <Card key={e.id} className="flex items-center justify-between !p-4">
                      <div>
                        <p className="font-medium text-surface-900 dark:text-surface-50">{e.name}</p>
                        <p className="text-xs text-surface-400">
                          {EXPENSE_CATEGORY_LABELS[e.category]}
                          {e.notes ? ` · ${e.notes}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="mr-2 font-mono text-sm font-semibold">
                          {formatCurrency(e.amount, currency)}
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => openEditEntry(e)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            store.setExpenseEntries(expenseEntries.filter((x) => x.id !== e.id))
                          }
                        >
                          <Trash2 className="h-4 w-4 text-accent-rose" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal
        open={budgetModal}
        onClose={() => setBudgetModal(false)}
        title={editingBudget ? 'Edit budget' : 'Add budget'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setBudgetModal(false)}>
              Cancel
            </Button>
            <Button onClick={saveBudget}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Category"
            value={budgetForm.category}
            onChange={(e) =>
              setBudgetForm({ ...budgetForm, category: e.target.value as ExpenseCategory })
            }
            options={CATEGORY_OPTIONS}
          />
          <Input
            label="Label"
            value={budgetForm.name}
            onChange={(e) => setBudgetForm({ ...budgetForm, name: e.target.value })}
            placeholder="Optional"
          />
          <Input
            label="Monthly amount"
            type="number"
            value={budgetForm.amount}
            onChange={(e) => setBudgetForm({ ...budgetForm, amount: e.target.value })}
          />
        </div>
      </Modal>

      <Modal
        open={entryModal}
        onClose={() => setEntryModal(false)}
        title={editingEntry ? 'Edit expense' : 'Log expense'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEntryModal(false)}>
              Cancel
            </Button>
            <Button onClick={saveEntry}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Category"
            value={entryForm.category}
            onChange={(e) =>
              setEntryForm({ ...entryForm, category: e.target.value as ExpenseCategory })
            }
            options={CATEGORY_OPTIONS}
          />
          <Input
            label="Label"
            value={entryForm.name}
            onChange={(e) => setEntryForm({ ...entryForm, name: e.target.value })}
            placeholder="Optional"
          />
          <Input
            label="Amount"
            type="number"
            value={entryForm.amount}
            onChange={(e) => setEntryForm({ ...entryForm, amount: e.target.value })}
          />
          <Input
            label="Date"
            type="date"
            value={entryForm.date}
            onChange={(e) => setEntryForm({ ...entryForm, date: e.target.value })}
          />
          <Input
            label="Notes"
            value={entryForm.notes}
            onChange={(e) => setEntryForm({ ...entryForm, notes: e.target.value })}
            placeholder="Optional"
          />
        </div>
      </Modal>
    </div>
  )
}
