import { describe, expect, it } from 'vitest'
import { createDefaultData, createId, type ExpenseEntry, type MonthlyExpense } from '@/types/finance'
import {
  applyBudgetToMonth,
  budgetVsActual,
  categoryBreakdown,
  entriesInMonth,
  entriesInYear,
  monthRange,
  monthlyTrend,
  periodInvestmentOutflow,
  periodSummary,
  yearMonth,
} from './cashflow'

const budgets: MonthlyExpense[] = [
  { id: 'b1', category: 'rent', name: 'Rent', amount: 20_000 },
  { id: 'b2', category: 'groceries', name: 'Groceries', amount: 8_000 },
]

const entries: ExpenseEntry[] = [
  { id: 'e1', category: 'rent', name: 'Rent', amount: 20_000, date: '2026-03-01' },
  { id: 'e2', category: 'groceries', name: 'BigBasket', amount: 9_500, date: '2026-03-12' },
  { id: 'e3', category: 'dining', name: 'Dinner', amount: 1_200, date: '2026-04-05' },
  { id: 'e4', category: 'groceries', name: 'Groceries', amount: 7_000, date: '2025-12-20' },
]

describe('yearMonth / monthRange', () => {
  it('parses year-month from ISO date', () => {
    expect(yearMonth('2026-08-10')).toBe('2026-08')
  })

  it('builds inclusive month range including leap Feb', () => {
    expect(monthRange('2024-02')).toEqual({ start: '2024-02-01', end: '2024-02-29' })
    expect(monthRange('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' })
  })
})

describe('entriesInMonth / entriesInYear', () => {
  it('filters by month', () => {
    expect(entriesInMonth(entries, '2026-03').map((e) => e.id)).toEqual(['e1', 'e2'])
  })

  it('filters by calendar year', () => {
    expect(entriesInYear(entries, 2026).map((e) => e.id)).toEqual(['e1', 'e2', 'e3'])
    expect(entriesInYear(entries, 2025).map((e) => e.id)).toEqual(['e4'])
  })
})

describe('categoryBreakdown', () => {
  it('aggregates and sorts descending', () => {
    const rows = categoryBreakdown(entriesInMonth(entries, '2026-03'))
    expect(rows[0]).toMatchObject({ category: 'rent', amount: 20_000 })
    expect(rows[1]).toMatchObject({ category: 'groceries', amount: 9_500 })
  })
})

describe('budgetVsActual', () => {
  it('computes variance per category for one month', () => {
    const rows = budgetVsActual(budgets, entriesInMonth(entries, '2026-03'))
    const rent = rows.find((r) => r.category === 'rent')
    const groceries = rows.find((r) => r.category === 'groceries')
    expect(rent).toMatchObject({ budget: 20_000, actual: 20_000, variance: 0 })
    expect(groceries).toMatchObject({ budget: 8_000, actual: 9_500, variance: 1_500 })
  })

  it('scales budget for yearly period', () => {
    const rows = budgetVsActual(budgets, entriesInYear(entries, 2026), 12)
    const rent = rows.find((r) => r.category === 'rent')
    expect(rent?.budget).toBe(20_000 * 12)
  })
})

describe('periodInvestmentOutflow', () => {
  it('counts SIPs × months and equity buys in range', () => {
    const data = createDefaultData()
    data.mutualFunds = [
      {
        id: 'mf1',
        name: 'Index',
        investedAmount: 1_00_000,
        currentValue: 1_10_000,
        monthlySip: 10_000,
      },
    ]
    data.trades = [
      {
        id: 't1',
        tradeId: '1',
        symbol: 'RELIANCE',
        tradeDate: '2026-03-10',
        tradeType: 'buy',
        quantity: 2,
        price: 1_000,
      },
      {
        id: 't2',
        tradeId: '2',
        symbol: 'RELIANCE',
        tradeDate: '2026-03-15',
        tradeType: 'sell',
        quantity: 1,
        price: 1_100,
      },
      {
        id: 't3',
        tradeId: '3',
        symbol: 'INFY',
        tradeDate: '2026-05-01',
        tradeType: 'buy',
        quantity: 5,
        price: 500,
      },
    ]
    const out = periodInvestmentOutflow(data, monthRange('2026-03'))
    expect(out.sips).toBe(10_000)
    expect(out.equityBuys).toBe(2_000)
    expect(out.total).toBe(12_000)
    expect(out.buyTrades).toHaveLength(1)
  })
})

describe('monthlyTrend', () => {
  it('returns 12 months ending at endYm', () => {
    const trend = monthlyTrend(entries, budgets, '2026-03', 12)
    expect(trend).toHaveLength(12)
    expect(trend[0].key).toBe('2025-04')
    expect(trend[11].key).toBe('2026-03')
    expect(trend[11].actual).toBe(29_500)
    expect(trend[11].budget).toBe(28_000)
  })
})

describe('periodSummary', () => {
  it('uses ledger when entries exist', () => {
    const data = createDefaultData()
    data.salary = { monthlyGross: 1_20_000, monthlyInHand: 1_00_000 }
    data.expenses = budgets
    data.expenseEntries = entries
    const s = periodSummary(data, 'month', { yearMonth: '2026-03' })
    expect(s.spendFromEntries).toBe(true)
    expect(s.spend).toBe(29_500)
    expect(s.income).toBe(1_00_000)
  })

  it('falls back to budget when no entries', () => {
    const data = createDefaultData()
    data.salary = { monthlyGross: 1_20_000, monthlyInHand: 1_00_000 }
    data.expenses = budgets
    data.expenseEntries = []
    const s = periodSummary(data, 'month', { yearMonth: '2026-08' })
    expect(s.spendFromEntries).toBe(false)
    expect(s.spend).toBe(28_000)
  })

  it('scales yearly', () => {
    const data = createDefaultData()
    data.salary = { monthlyGross: 1_20_000, monthlyInHand: 1_00_000 }
    data.expenses = budgets
    const s = periodSummary(data, 'year', { year: 2026 })
    expect(s.monthsInPeriod).toBe(12)
    expect(s.income).toBe(12_00_000)
    expect(s.spend).toBe(28_000 * 12)
  })
})

describe('applyBudgetToMonth', () => {
  it('adds missing budget lines and skips duplicates', () => {
    const first = applyBudgetToMonth(budgets, [], '2026-08', createId)
    expect(first.added).toBe(2)
    expect(first.entries).toHaveLength(2)
    expect(first.entries.every((e) => e.date === '2026-08-01')).toBe(true)

    const second = applyBudgetToMonth(budgets, first.entries, '2026-08', createId)
    expect(second.added).toBe(0)
    expect(second.entries).toHaveLength(2)
  })
})
