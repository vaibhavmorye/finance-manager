import { describe, expect, it } from 'vitest'
import {
  calculateInterest,
  lumpSumMaturity,
  requiredPrincipalForTarget,
  addMonthsIso,
} from './interest'
import { calculateSwp, requiredCorpusForSwp } from './swp'

describe('lumpSumMaturity', () => {
  it('applies simple interest', () => {
    const value = lumpSumMaturity(1_00_000, 6, 12, 'simple')
    expect(value).toBeCloseTo(1_06_000, 0)
  })

  it('compounds yearly', () => {
    const value = lumpSumMaturity(1_00_000, 10, 24, 'yearly')
    expect(value).toBeCloseTo(1_21_000, 0)
  })
})

describe('requiredPrincipalForTarget', () => {
  it('inverts lump-sum maturity', () => {
    const target = 2_00_000
    const principal = requiredPrincipalForTarget(target, 8, 36, 'quarterly')
    const matured = lumpSumMaturity(principal, 8, 36, 'quarterly')
    expect(matured).toBeCloseTo(target, 0)
  })
})

describe('calculateInterest', () => {
  it('computes maturity mode', () => {
    const result = calculateInterest({
      mode: 'maturity',
      principal: 5_00_000,
      annualRatePercent: 7,
      years: 3,
      compounding: 'quarterly',
    })
    expect(result.totalInvested).toBe(5_00_000)
    expect(result.maturityValue).toBeGreaterThan(5_00_000)
    expect(result.interestEarned).toBeCloseTo(result.maturityValue - result.totalInvested, 5)
    expect(result.projection.length).toBeGreaterThan(1)
  })

  it('computes required principal mode', () => {
    const result = calculateInterest({
      mode: 'required_principal',
      targetMaturity: 10_00_000,
      annualRatePercent: 6.5,
      years: 5,
      compounding: 'yearly',
    })
    expect(result.requiredPrincipal).toBeDefined()
    expect(result.requiredPrincipal!).toBeLessThan(10_00_000)
    expect(result.maturityValue).toBe(10_00_000)
  })

  it('projects recurring deposits', () => {
    const result = calculateInterest({
      mode: 'recurring',
      principal: 0,
      monthlyDeposit: 10_000,
      annualRatePercent: 7,
      years: 5,
      compounding: 'monthly',
    })
    expect(result.totalInvested).toBe(10_000 * 60)
    expect(result.maturityValue).toBeGreaterThan(result.totalInvested)
  })
})

describe('addMonthsIso', () => {
  it('adds months across year boundary', () => {
    expect(addMonthsIso('2024-11-15', 3)).toBe('2025-02-15')
  })
})

describe('requiredCorpusForSwp', () => {
  it('is zero withdrawal * months when return is 0', () => {
    expect(requiredCorpusForSwp(50_000, 0, 10)).toBe(50_000 * 120)
  })

  it('is less than zero-return corpus when returns are positive', () => {
    const withReturn = requiredCorpusForSwp(50_000, 8, 20)
    const noReturn = requiredCorpusForSwp(50_000, 0, 20)
    expect(withReturn).toBeLessThan(noReturn)
    expect(withReturn).toBeGreaterThan(0)
  })
})

describe('calculateSwp', () => {
  it('marks sustainable when corpus equals required', () => {
    const monthly = 40_000
    const years = 15
    const ret = 7
    const needed = requiredCorpusForSwp(monthly, ret, years)
    const result = calculateSwp({
      mode: 'sustainability',
      corpus: needed,
      monthlyWithdrawal: monthly,
      annualReturnPercent: ret,
      years,
    })
    expect(result.sustainable).toBe(true)
    expect(result.monthsUntilDeplete).toBeNull()
    expect(result.endingCorpus).toBeGreaterThanOrEqual(0)
    expect(result.projection.length).toBeGreaterThan(1)
  })

  it('detects early depletion when corpus is too small', () => {
    const result = calculateSwp({
      mode: 'sustainability',
      corpus: 5_00_000,
      monthlyWithdrawal: 50_000,
      annualReturnPercent: 6,
      years: 20,
    })
    expect(result.sustainable).toBe(false)
    expect(result.monthsUntilDeplete).not.toBeNull()
    expect(result.monthsUntilDeplete!).toBeLessThan(20 * 12)
  })

  it('required_corpus mode seeds with needed corpus', () => {
    const result = calculateSwp({
      mode: 'required_corpus',
      monthlyWithdrawal: 30_000,
      annualReturnPercent: 8,
      years: 25,
    })
    expect(result.requiredCorpus).toBeGreaterThan(0)
    expect(result.sustainable).toBe(true)
  })
})
