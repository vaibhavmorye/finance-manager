import { describe, expect, it } from 'vitest'
import { financeDataSchema } from '@/lib/schemas'
import { createDemoData } from '@/lib/demoData'

describe('createDemoData', () => {
  it('produces a complete, schema-valid sample household', () => {
    const data = createDemoData(new Date('2026-08-10T12:00:00'))
    const parsed = financeDataSchema.parse(data)

    expect(parsed.profile.onboardingComplete).toBe(true)
    expect(parsed.profile.name).toMatch(/Demo/i)
    expect(parsed.salary.monthlyGross).toBeGreaterThan(0)
    expect(parsed.salary.monthlyInHand).toBeGreaterThan(0)
    expect(parsed.stocks.length).toBeGreaterThan(0)
    expect(parsed.trades.length).toBeGreaterThan(0)
    expect(parsed.mutualFunds.length).toBeGreaterThan(0)
    expect(parsed.fixedDeposits.length).toBeGreaterThan(0)
    expect(parsed.otherAssets.length).toBeGreaterThan(0)
    expect(parsed.savingPots.length).toBeGreaterThan(0)
    expect(parsed.homeLoans.length).toBeGreaterThan(0)
    expect(parsed.otherDebts.length).toBeGreaterThan(0)
    expect(parsed.healthInsurance.length).toBeGreaterThan(0)
    expect(parsed.expenses.length).toBeGreaterThan(0)
    expect(parsed.expenseEntries.length).toBeGreaterThan(0)
    expect(parsed.taxProfile.section80C).toBeGreaterThan(0)
    expect(parsed.otherIncomes.length).toBeGreaterThan(0)
  })
})
