import type { FinanceData, TaxProfile } from '@/types/finance'
import { createDefaultTaxProfile } from '@/types/finance'
import {
  capitalGainsForFy,
  capitalGainsTaxFromSummary,
  type CapitalGainsFySummary,
} from '@/lib/finance/capitalGains'

export type TaxRegime = 'old' | 'new'

export interface TaxSlab {
  upTo: number | null
  rate: number
}

/** FY 2025-26 new regime (Budget 2025). */
export const NEW_REGIME_SLABS_FY2025: TaxSlab[] = [
  { upTo: 4_00_000, rate: 0 },
  { upTo: 8_00_000, rate: 0.05 },
  { upTo: 12_00_000, rate: 0.1 },
  { upTo: 16_00_000, rate: 0.15 },
  { upTo: 20_00_000, rate: 0.2 },
  { upTo: 24_00_000, rate: 0.25 },
  { upTo: null, rate: 0.3 },
]

export const OLD_REGIME_SLABS_BELOW_60: TaxSlab[] = [
  { upTo: 2_50_000, rate: 0 },
  { upTo: 5_00_000, rate: 0.05 },
  { upTo: 10_00_000, rate: 0.2 },
  { upTo: null, rate: 0.3 },
]

export const OLD_REGIME_SLABS_SENIOR: TaxSlab[] = [
  { upTo: 3_00_000, rate: 0 },
  { upTo: 5_00_000, rate: 0.05 },
  { upTo: 10_00_000, rate: 0.2 },
  { upTo: null, rate: 0.3 },
]

export const CESS_RATE = 0.04
export const STD_DEDUCTION_OLD = 50_000
export const STD_DEDUCTION_NEW = 75_000
export const CAP_80C = 1_50_000
export const CAP_80CCD1B = 50_000
export const CAP_80D_BELOW_60 = 25_000
export const CAP_80D_SENIOR = 50_000
export const CAP_24B = 2_00_000
export const REBATE_87A_OLD = 12_500
export const REBATE_87A_OLD_LIMIT = 5_00_000
export const REBATE_87A_NEW = 60_000
export const REBATE_87A_NEW_LIMIT = 12_00_000

export interface RegimeTaxResult {
  regime: TaxRegime
  grossSalary: number
  otherIncome: number
  debtSlabGains: number
  standardDeduction: number
  hraExemption: number
  section80C: number
  section80D: number
  section80CCD1B: number
  section24b: number
  totalDeductions: number
  taxableIncome: number
  slabTaxBeforeRebate: number
  rebate87A: number
  slabTax: number
  stcgTax: number
  ltcgTax: number
  cess: number
  totalTax: number
}

export interface TaxOptimizationTip {
  id: string
  message: string
}

export interface TaxComparison {
  fyStartYear: number
  capitalGains: CapitalGainsFySummary
  old: RegimeTaxResult
  new: RegimeTaxResult
  recommended: TaxRegime
  savings: number
  tips: TaxOptimizationTip[]
}

export function computeHraExemption(input: {
  basicSalaryAnnual: number
  hraReceivedAnnual: number
  rentPaidAnnual: number
  isMetro: boolean
}): number {
  const basic = Math.max(0, input.basicSalaryAnnual)
  const hra = Math.max(0, input.hraReceivedAnnual)
  const rent = Math.max(0, input.rentPaidAnnual)
  if (basic <= 0 || hra <= 0) return 0
  const excessRent = Math.max(0, rent - 0.1 * basic)
  const pctLimit = (input.isMetro ? 0.5 : 0.4) * basic
  return Math.round(Math.min(hra, excessRent, pctLimit) * 100) / 100
}

export function taxOnSlabs(taxableIncome: number, slabs: TaxSlab[]): number {
  const income = Math.max(0, taxableIncome)
  let tax = 0
  let prev = 0
  for (const slab of slabs) {
    const ceiling = slab.upTo ?? Infinity
    const band = Math.min(income, ceiling) - prev
    if (band > 0) tax += band * slab.rate
    if (income <= ceiling) break
    prev = ceiling
  }
  return Math.round(tax * 100) / 100
}

function cap80D(claimed: number, age: number): number {
  const limit = age >= 60 ? CAP_80D_SENIOR : CAP_80D_BELOW_60
  return Math.min(Math.max(0, claimed), limit)
}

function annualOtherIncome(data: FinanceData): number {
  return data.otherIncomes.reduce((sum, i) => {
    if (i.frequency === 'monthly') return sum + i.amount * 12
    if (i.frequency === 'yearly') return sum + i.amount
    return sum
  }, 0)
}

function applyRebate(
  slabTax: number,
  taxableIncome: number,
  regime: TaxRegime,
): number {
  if (regime === 'old') {
    if (taxableIncome > REBATE_87A_OLD_LIMIT) return 0
    return Math.min(slabTax, REBATE_87A_OLD)
  }
  if (taxableIncome > REBATE_87A_NEW_LIMIT) return 0
  return Math.min(slabTax, REBATE_87A_NEW)
}

export function calculateRegimeTax(input: {
  regime: TaxRegime
  grossSalary: number
  otherIncome: number
  debtSlabGains: number
  age: number
  taxProfile: TaxProfile
  stcgTax: number
  ltcgTax: number
}): RegimeTaxResult {
  const { regime, age, taxProfile } = input
  const grossSalary = Math.max(0, input.grossSalary)
  const otherIncome = Math.max(0, input.otherIncome)
  const debtSlabGains = input.debtSlabGains // can be negative (loss)

  const standardDeduction =
    grossSalary > 0 ? (regime === 'old' ? STD_DEDUCTION_OLD : STD_DEDUCTION_NEW) : 0

  let hraExemption = 0
  let section80C = 0
  let section80D = 0
  let section80CCD1B = 0
  let section24b = 0

  if (regime === 'old') {
    hraExemption = computeHraExemption(taxProfile)
    section80C = Math.min(Math.max(0, taxProfile.section80C), CAP_80C)
    section80D = cap80D(taxProfile.section80D, age)
    section80CCD1B = Math.min(Math.max(0, taxProfile.section80CCD1B), CAP_80CCD1B)
    section24b = Math.min(Math.max(0, taxProfile.section24b), CAP_24B)
  }

  const totalDeductions =
    standardDeduction +
    hraExemption +
    section80C +
    section80D +
    section80CCD1B +
    section24b

  const taxableIncome = Math.max(
    0,
    grossSalary + otherIncome + Math.max(0, debtSlabGains) - totalDeductions,
  )

  const slabs =
    regime === 'new'
      ? NEW_REGIME_SLABS_FY2025
      : age >= 60
        ? OLD_REGIME_SLABS_SENIOR
        : OLD_REGIME_SLABS_BELOW_60

  const slabTaxBeforeRebate = taxOnSlabs(taxableIncome, slabs)
  const rebate87A = applyRebate(slabTaxBeforeRebate, taxableIncome, regime)
  const slabTax = Math.max(0, slabTaxBeforeRebate - rebate87A)
  const specialCg = Math.max(0, input.stcgTax) + Math.max(0, input.ltcgTax)
  const cess = Math.round((slabTax + specialCg) * CESS_RATE * 100) / 100
  const totalTax = Math.round((slabTax + specialCg + cess) * 100) / 100

  return {
    regime,
    grossSalary,
    otherIncome,
    debtSlabGains,
    standardDeduction,
    hraExemption,
    section80C,
    section80D,
    section80CCD1B,
    section24b,
    totalDeductions,
    taxableIncome,
    slabTaxBeforeRebate,
    rebate87A,
    slabTax,
    stcgTax: Math.max(0, input.stcgTax),
    ltcgTax: Math.max(0, input.ltcgTax),
    cess,
    totalTax,
  }
}

function buildTips(
  comparison: Omit<TaxComparison, 'tips'>,
  taxProfile: TaxProfile,
): TaxOptimizationTip[] {
  const tips: TaxOptimizationTip[] = []
  const { old, new: neu, recommended, savings, capitalGains } = comparison

  if (savings > 0) {
    tips.push({
      id: 'regime',
      message: `${recommended === 'new' ? 'New' : 'Old'} regime saves ${formatInr(savings)} vs the other for this FY.`,
    })
  } else {
    tips.push({
      id: 'regime-tie',
      message: 'Both regimes produce the same tax for your current inputs.',
    })
  }

  const unused80C = CAP_80C - Math.min(taxProfile.section80C, CAP_80C)
  if (unused80C >= 5_000 && recommended === 'old') {
    tips.push({
      id: '80c',
      message: `₹${unused80C.toLocaleString('en-IN')} of 80C headroom left — ELSS / PPF / EPF / life premium could cut old-regime tax.`,
    })
  } else if (unused80C >= 50_000 && old.totalTax < neu.totalTax + 20_000) {
    tips.push({
      id: '80c-switch',
      message: `Unused 80C room of ₹${unused80C.toLocaleString('en-IN')} — filling it may make old regime competitive.`,
    })
  }

  const unused80D =
    (old.section80D > 0 || taxProfile.section80D === 0
      ? CAP_80D_BELOW_60
      : CAP_80D_BELOW_60) - Math.min(taxProfile.section80D, CAP_80D_BELOW_60)
  if (taxProfile.section80D < CAP_80D_BELOW_60 && unused80D >= 5_000) {
    tips.push({
      id: '80d',
      message: `Health insurance (80D) has ~₹${unused80D.toLocaleString('en-IN')} unused vs the common ₹25k cap.`,
    })
  }

  const unusedCcd = CAP_80CCD1B - Math.min(taxProfile.section80CCD1B, CAP_80CCD1B)
  if (unusedCcd >= 5_000) {
    tips.push({
      id: 'nps',
      message: `NPS 80CCD(1B) has ₹${unusedCcd.toLocaleString('en-IN')} unused (extra ₹50k over 80C, old regime only).`,
    })
  }

  const ltcgLeft = Math.max(0, 1_25_000 - capitalGains.ltcgExemptionUsed)
  if (ltcgLeft >= 10_000 && capitalGains.equityLtcg > 0) {
    tips.push({
      id: 'ltcg-exempt',
      message: `₹${ltcgLeft.toLocaleString('en-IN')} of equity LTCG exemption still unused this FY.`,
    })
  } else if (capitalGains.equityLtcgTaxable > 0) {
    tips.push({
      id: 'ltcg-tax',
      message: `Taxable equity LTCG ₹${Math.round(capitalGains.equityLtcgTaxable).toLocaleString('en-IN')} at 12.5% after the ₹1.25L exemption.`,
    })
  }

  if (capitalGains.debtSlabGains > 0) {
    tips.push({
      id: 'debt-mf',
      message: `Debt MF gains of ₹${Math.round(capitalGains.debtSlabGains).toLocaleString('en-IN')} are taxed at slab rates (not STCG/LTCG special rates).`,
    })
  }

  if (capitalGains.equityStcg > 50_000) {
    tips.push({
      id: 'stcg',
      message: `Equity STCG ₹${Math.round(capitalGains.equityStcg).toLocaleString('en-IN')} is taxed at 20% — holding past 12 months moves gains to LTCG.`,
    })
  }

  return tips
}

function formatInr(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

export function compareIncomeTax(data: FinanceData, fyStartYear?: number): TaxComparison {
  const taxProfile = data.taxProfile ?? createDefaultTaxProfile()
  const fy = fyStartYear ?? taxProfile.fyStartYear
  const grossSalary = Math.max(0, (data.salary.monthlyGross ?? 0) * 12)
  const otherIncome = annualOtherIncome(data)
  const age = data.profile.age ?? 30

  const capitalGains = capitalGainsForFy(data, fy)
  const cgTax = capitalGainsTaxFromSummary(capitalGains)

  const base = {
    grossSalary,
    otherIncome,
    debtSlabGains: capitalGains.debtSlabGains,
    age,
    taxProfile: { ...taxProfile, fyStartYear: fy },
    stcgTax: cgTax.stcgTax,
    ltcgTax: cgTax.ltcgTax,
  }

  const old = calculateRegimeTax({ ...base, regime: 'old' })
  const neu = calculateRegimeTax({ ...base, regime: 'new' })
  const recommended: TaxRegime = neu.totalTax <= old.totalTax ? 'new' : 'old'
  const savings = Math.abs(old.totalTax - neu.totalTax)

  const partial = {
    fyStartYear: fy,
    capitalGains,
    old,
    new: neu,
    recommended,
    savings,
  }

  return {
    ...partial,
    tips: buildTips(partial, taxProfile),
  }
}
