import { describe, expect, it } from 'vitest'
import { calculateFire } from './fire'
import { calculateSip } from './sip'

describe('calculateFire', () => {
  it('computes FIRE number from expenses and withdrawal rate', () => {
    const result = calculateFire({
      currentCorpus: 50_00_000,
      monthlySavings: 50_000,
      expectedReturnPercent: 10,
      inflationPercent: 5,
      withdrawalRatePercent: 4,
      currentAge: 30,
      annualExpenses: 6_00_000,
    })
    expect(result.fireNumber).toBe(1_50_00_000)
    expect(result.yearsToFire).not.toBeNull()
    expect(result.yearsToFire!).toBeGreaterThan(0)
    expect(result.projection.length).toBeGreaterThan(1)
  })
})

describe('calculateSip', () => {
  it('grows corpus with monthly SIP', () => {
    const result = calculateSip({
      monthlyAmount: 10_000,
      annualReturnPercent: 12,
      years: 10,
    })
    expect(result.totalInvested).toBe(12_00_000)
    expect(result.futureValue).toBeGreaterThan(result.totalInvested)
    expect(result.totalGains).toBeGreaterThan(0)
  })

  it('applies annual step-up', () => {
    const flat = calculateSip({ monthlyAmount: 10_000, annualReturnPercent: 12, years: 5 })
    const stepped = calculateSip({
      monthlyAmount: 10_000,
      annualReturnPercent: 12,
      years: 5,
      stepUpPercent: 10,
    })
    expect(stepped.futureValue).toBeGreaterThan(flat.futureValue)
  })
})
