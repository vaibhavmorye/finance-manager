import { describe, expect, it } from 'vitest'
import { calculateEmi, generateAmortization, calculatePrepaymentPlan } from './loan'

describe('calculateEmi', () => {
  it('calculates standard home loan EMI', () => {
    const emi = calculateEmi(50_00_000, 8.5, 240)
    expect(emi).toBeGreaterThan(40_000)
    expect(emi).toBeLessThan(50_000)
  })

  it('handles zero interest', () => {
    expect(calculateEmi(120_000, 0, 12)).toBe(10_000)
  })

  it('returns 0 for zero principal', () => {
    expect(calculateEmi(0, 8, 120)).toBe(0)
  })
})

describe('generateAmortization', () => {
  it('pays off loan within tenure', () => {
    const result = generateAmortization({
      principal: 10_00_000,
      annualRate: 9,
      tenureMonths: 120,
      startDate: '2024-01-01',
    })
    expect(result.schedule.length).toBe(120)
    expect(result.schedule[result.schedule.length - 1].balance).toBeLessThan(1)
    expect(result.totalInterest).toBeGreaterThan(0)
  })

  it('honors rate changes', () => {
    const result = generateAmortization({
      principal: 10_00_000,
      annualRate: 8,
      tenureMonths: 60,
      startDate: '2024-01-01',
      rateChanges: [{ date: '2025-01-01', interestRate: 10 }],
    })
    const before = result.schedule.find((r) => r.date.startsWith('2024-06'))
    const after = result.schedule.find((r) => r.date.startsWith('2025-06'))
    expect(before?.rate).toBe(8)
    expect(after?.rate).toBe(10)
  })
})

describe('calculatePrepaymentPlan', () => {
  it('saves interest with monthly prepayment', () => {
    const result = calculatePrepaymentPlan({
      principal: 50_00_000,
      annualRate: 8.5,
      tenureMonths: 240,
      startDate: '2024-01-01',
      extraAmount: 10_000,
      frequency: 'monthly',
      mode: 'reduce_tenure',
    })
    expect(result.interestSaved).toBeGreaterThan(0)
    expect(result.monthsSaved).toBeGreaterThan(0)
  })
})
