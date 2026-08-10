import { describe, expect, it } from 'vitest'
import {
  computeHraExemption,
  taxOnSlabs,
  calculateRegimeTax,
  compareIncomeTax,
  NEW_REGIME_SLABS_FY2025,
  OLD_REGIME_SLABS_BELOW_60,
  STD_DEDUCTION_NEW,
} from './tax'
import { createDefaultData, createDefaultTaxProfile } from '@/types/finance'

describe('computeHraExemption', () => {
  it('takes the minimum of HRA, excess rent, and % of basic', () => {
    const exemption = computeHraExemption({
      basicSalaryAnnual: 6_00_000,
      hraReceivedAnnual: 3_00_000,
      rentPaidAnnual: 2_40_000,
      isMetro: true,
    })
    // excess rent = 240000 - 60000 = 180000
    // 50% basic = 300000
    // hra = 300000 → min = 180000
    expect(exemption).toBe(1_80_000)
  })
})

describe('taxOnSlabs', () => {
  it('computes new regime tax for mid income', () => {
    // taxable 10L: 0 on 4L + 5% of 4L + 10% of 2L = 20k + 20k = 40k
    expect(taxOnSlabs(10_00_000, NEW_REGIME_SLABS_FY2025)).toBe(40_000)
  })

  it('computes old regime tax', () => {
    // 10L: 0–2.5 nil, 2.5–5 @5% = 12.5k, 5–10 @20% = 1L → 1,12,500
    expect(taxOnSlabs(10_00_000, OLD_REGIME_SLABS_BELOW_60)).toBe(1_12_500)
  })
})

describe('calculateRegimeTax', () => {
  it('applies new regime rebate for income up to 12L', () => {
    const result = calculateRegimeTax({
      regime: 'new',
      grossSalary: 12_00_000 + STD_DEDUCTION_NEW,
      otherIncome: 0,
      debtSlabGains: 0,
      age: 30,
      taxProfile: createDefaultTaxProfile(2025),
      stcgTax: 0,
      ltcgTax: 0,
    })
    expect(result.taxableIncome).toBe(12_00_000)
    expect(result.rebate87A).toBeGreaterThan(0)
    expect(result.slabTax).toBe(0)
    expect(result.totalTax).toBe(0)
  })

  it('ignores chapter VIA deductions under new regime', () => {
    const profile = createDefaultTaxProfile(2025)
    profile.section80C = 1_50_000
    const result = calculateRegimeTax({
      regime: 'new',
      grossSalary: 20_00_000,
      otherIncome: 0,
      debtSlabGains: 0,
      age: 30,
      taxProfile: profile,
      stcgTax: 0,
      ltcgTax: 0,
    })
    expect(result.section80C).toBe(0)
    expect(result.standardDeduction).toBe(STD_DEDUCTION_NEW)
  })
})

describe('compareIncomeTax', () => {
  it('recommends a regime and includes CG tax', () => {
    const data = createDefaultData()
    data.salary = { monthlyGross: 2_00_000, monthlyInHand: 1_50_000 }
    data.taxProfile = createDefaultTaxProfile(2025)
    data.taxProfile.section80C = 1_50_000
    data.taxProfile.section80D = 25_000
    data.profile.age = 32

    const result = compareIncomeTax(data, 2025)
    expect(result.old.totalTax).toBeGreaterThan(0)
    expect(result.new.totalTax).toBeGreaterThan(0)
    expect(['old', 'new']).toContain(result.recommended)
    expect(result.tips.length).toBeGreaterThan(0)
  })
})
