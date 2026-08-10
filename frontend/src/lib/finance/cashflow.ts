import type {
  ExpenseCategory,
  ExpenseEntry,
  FinanceData,
  MonthlyExpense,
} from '@/types/finance'
import { EXPENSE_CATEGORY_LABELS } from '@/types/finance'
import {
  monthlyEmiTotal,
  monthlyIncome,
  monthlyInsurancePremium,
  monthlySipTotal,
} from './networth'

export type PeriodMode = 'month' | 'year'

export interface DateRange {
  start: string // YYYY-MM-DD inclusive
  end: string // YYYY-MM-DD inclusive
}

export interface CategorySlice {
  category: ExpenseCategory
  label: string
  amount: number
}

export interface BudgetVsActualRow {
  category: ExpenseCategory
  label: string
  budget: number
  actual: number
  variance: number
}

export interface InvestmentOutflow {
  sips: number
  equityBuys: number
  total: number
  buyTrades: { symbol: string; date: string; amount: number }[]
}

export interface TrendPoint {
  key: string // YYYY-MM
  label: string
  actual: number
  budget: number
}

export interface PeriodSummary {
  mode: PeriodMode
  monthsInPeriod: number
  income: number
  spend: number
  spendFromEntries: boolean
  emis: number
  insurance: number
  investments: number
  outflow: number
  surplus: number
  savingsRate: number
}

/** YYYY-MM from a date string or Date. */
export function yearMonth(date: string | Date): string {
  if (typeof date === 'string') return date.slice(0, 7)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function monthRange(ym: string): DateRange {
  const [y, m] = ym.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  const mm = String(m).padStart(2, '0')
  return {
    start: `${y}-${mm}-01`,
    end: `${y}-${mm}-${String(lastDay).padStart(2, '0')}`,
  }
}

export function yearRange(year: number): DateRange {
  return { start: `${year}-01-01`, end: `${year}-12-31` }
}

export function inRange(date: string, range: DateRange): boolean {
  return date >= range.start && date <= range.end
}

export function entriesInRange(entries: ExpenseEntry[], range: DateRange): ExpenseEntry[] {
  return entries.filter((e) => inRange(e.date, range))
}

export function entriesInMonth(entries: ExpenseEntry[], ym: string): ExpenseEntry[] {
  return entriesInRange(entries, monthRange(ym))
}

export function entriesInYear(entries: ExpenseEntry[], year: number): ExpenseEntry[] {
  return entriesInRange(entries, yearRange(year))
}

export function sumAmounts(entries: { amount: number }[]): number {
  return entries.reduce((s, e) => s + e.amount, 0)
}

export function categoryBreakdown(
  items: { category: ExpenseCategory; amount: number }[],
): CategorySlice[] {
  const map = new Map<ExpenseCategory, number>()
  for (const item of items) {
    map.set(item.category, (map.get(item.category) ?? 0) + item.amount)
  }
  return [...map.entries()]
    .map(([category, amount]) => ({
      category,
      label: EXPENSE_CATEGORY_LABELS[category],
      amount,
    }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount)
}

export function budgetVsActual(
  budgets: MonthlyExpense[],
  entries: ExpenseEntry[],
  monthsInPeriod = 1,
): BudgetVsActualRow[] {
  const budgetByCat = new Map<ExpenseCategory, number>()
  for (const b of budgets) {
    budgetByCat.set(b.category, (budgetByCat.get(b.category) ?? 0) + b.amount * monthsInPeriod)
  }
  const actualByCat = new Map<ExpenseCategory, number>()
  for (const e of entries) {
    actualByCat.set(e.category, (actualByCat.get(e.category) ?? 0) + e.amount)
  }
  const cats = new Set<ExpenseCategory>([...budgetByCat.keys(), ...actualByCat.keys()])
  return [...cats]
    .map((category) => {
      const budget = budgetByCat.get(category) ?? 0
      const actual = actualByCat.get(category) ?? 0
      return {
        category,
        label: EXPENSE_CATEGORY_LABELS[category],
        budget,
        actual,
        variance: actual - budget,
      }
    })
    .sort((a, b) => Math.max(b.budget, b.actual) - Math.max(a.budget, a.actual))
}

export function periodInvestmentOutflow(data: FinanceData, range: DateRange): InvestmentOutflow {
  const startYm = yearMonth(range.start)
  const endYm = yearMonth(range.end)
  let months = 0
  {
    let [y, m] = startYm.split('-').map(Number)
    const [ey, em] = endYm.split('-').map(Number)
    while (y < ey || (y === ey && m <= em)) {
      months += 1
      m += 1
      if (m > 12) {
        m = 1
        y += 1
      }
    }
  }
  const sips = monthlySipTotal(data) * months
  const buyTrades = (data.trades ?? [])
    .filter((t) => t.tradeType === 'buy' && inRange(t.tradeDate, range))
    .map((t) => ({
      symbol: t.symbol,
      date: t.tradeDate,
      amount: t.quantity * t.price,
    }))
  const equityBuys = buyTrades.reduce((s, t) => s + t.amount, 0)
  return { sips, equityBuys, total: sips + equityBuys, buyTrades }
}

/** Last `count` calendar months ending at `endYm` (inclusive), oldest first. */
export function monthlyTrend(
  entries: ExpenseEntry[],
  budgets: MonthlyExpense[],
  endYm: string,
  count = 12,
): TrendPoint[] {
  const budgetTotal = monthlyBudgetTotal(budgets)
  const points: TrendPoint[] = []
  let [y, m] = endYm.split('-').map(Number)
  // Walk back count-1 months then emit forward
  m -= count - 1
  while (m <= 0) {
    m += 12
    y -= 1
  }
  for (let i = 0; i < count; i++) {
    const ym = `${y}-${String(m).padStart(2, '0')}`
    const monthEntries = entriesInMonth(entries, ym)
    points.push({
      key: ym,
      label: ym,
      actual: sumAmounts(monthEntries),
      budget: budgetTotal,
    })
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return points
}

export function monthlyBudgetTotal(budgets: MonthlyExpense[]): number {
  return budgets.reduce((s, e) => s + e.amount, 0)
}

/**
 * Period cash-flow summary.
 * Spend uses ledger entries when any exist in the period; otherwise falls back to budget × months.
 */
export function periodSummary(
  data: FinanceData,
  mode: PeriodMode,
  ref: { yearMonth?: string; year?: number },
): PeriodSummary {
  const monthsInPeriod = mode === 'year' ? 12 : 1
  const range =
    mode === 'year'
      ? yearRange(ref.year ?? new Date().getFullYear())
      : monthRange(ref.yearMonth ?? yearMonth(new Date()))

  const entries = entriesInRange(data.expenseEntries ?? [], range)
  const spendFromEntries = entries.length > 0
  const spend = spendFromEntries
    ? sumAmounts(entries)
    : monthlyBudgetTotal(data.expenses) * monthsInPeriod

  const income = monthlyIncome(data) * monthsInPeriod
  const emis = monthlyEmiTotal(data) * monthsInPeriod
  const insurance = monthlyInsurancePremium(data) * monthsInPeriod
  const investments = periodInvestmentOutflow(data, range).total
  const outflow = spend + emis + insurance + investments
  const surplus = income - outflow
  // Savings rate excludes SIPs/equity buys (same spirit as monthlyCashFlow)
  const savingsRate =
    income > 0 ? ((income - spend - emis - insurance) / income) * 100 : 0

  return {
    mode,
    monthsInPeriod,
    income,
    spend,
    spendFromEntries,
    emis,
    insurance,
    investments,
    outflow,
    surplus,
    savingsRate,
  }
}

/** Duplicate key used by apply-budget: category + name + amount within a month. */
export function budgetEntryKey(e: {
  category: string
  name: string
  amount: number
}): string {
  return `${e.category}|${e.name}|${e.amount}`
}

/**
 * Copies each recurring budget line into the ledger dated the 1st of `ym`,
 * skipping duplicates that already match category+name+amount in that month.
 */
export function applyBudgetToMonth(
  budgets: MonthlyExpense[],
  existing: ExpenseEntry[],
  ym: string,
  createId: () => string,
): { entries: ExpenseEntry[]; added: number } {
  const range = monthRange(ym)
  const date = range.start
  const existingKeys = new Set(
    entriesInMonth(existing, ym).map((e) => budgetEntryKey(e)),
  )
  const toAdd: ExpenseEntry[] = []
  for (const b of budgets) {
    const key = budgetEntryKey(b)
    if (existingKeys.has(key)) continue
    existingKeys.add(key)
    toAdd.push({
      id: createId(),
      category: b.category,
      name: b.name,
      amount: b.amount,
      date,
    })
  }
  return { entries: [...existing, ...toAdd], added: toAdd.length }
}
