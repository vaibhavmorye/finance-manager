import type { FinanceData } from '@/types/finance'
import { effectiveLoanEmi, effectiveLoanOutstanding } from './loan'

export interface NetWorthBreakdown {
  stocks: number
  fixedDeposits: number
  mutualFunds: number
  otherAssets: number
  propertyEquity: number
  totalAssets: number
  homeLoanBalance: number
  otherDebtBalance: number
  totalLiabilities: number
  netWorth: number
}

export function stocksValue(data: FinanceData): number {
  return data.stocks.reduce((s, x) => s + x.quantity * x.currentPrice, 0)
}

export function fdValue(data: FinanceData): number {
  return data.fixedDeposits.reduce((s, x) => s + x.principal, 0)
}

export function mfValue(data: FinanceData): number {
  return data.mutualFunds.reduce((s, x) => s + x.currentValue, 0)
}

export function otherAssetsValue(data: FinanceData): number {
  return (data.otherAssets ?? []).reduce((s, x) => s + x.quantity * x.currentPrice, 0)
}

export function propertyMarketValue(data: FinanceData): number {
  return data.homeLoans.reduce((s, x) => s + x.marketValue, 0)
}

/** Outstanding principal as of today, including rate changes & prepayments. */
export function homeLoanOutstanding(data: FinanceData): number {
  return data.homeLoans.reduce((sum, loan) => sum + effectiveLoanOutstanding(loan), 0)
}

export function otherDebtBalance(data: FinanceData): number {
  return data.otherDebts.reduce((s, x) => s + x.principal, 0)
}

export function calculateNetWorth(data: FinanceData): NetWorthBreakdown {
  const stocks = stocksValue(data)
  const fixedDeposits = fdValue(data)
  const mutualFunds = mfValue(data)
  const otherAssets = otherAssetsValue(data)
  const property = propertyMarketValue(data)
  const homeLoanBalance = homeLoanOutstanding(data)
  const otherDebt = otherDebtBalance(data)
  const propertyEquity = property - homeLoanBalance
  const totalAssets = stocks + fixedDeposits + mutualFunds + otherAssets + property
  const totalLiabilities = homeLoanBalance + otherDebt

  return {
    stocks,
    fixedDeposits,
    mutualFunds,
    otherAssets,
    propertyEquity,
    totalAssets,
    homeLoanBalance,
    otherDebtBalance: otherDebt,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
  }
}

export function monthlyIncome(data: FinanceData): number {
  const other = data.otherIncomes.reduce((sum, i) => {
    if (i.frequency === 'monthly') return sum + i.amount
    if (i.frequency === 'yearly') return sum + i.amount / 12
    return sum
  }, 0)
  return data.salary.monthlyInHand + other
}

export function monthlyExpensesTotal(data: FinanceData): number {
  return data.expenses.reduce((s, e) => s + e.amount, 0)
}

export function monthlyEmiTotal(data: FinanceData): number {
  const home = data.homeLoans.reduce((s, l) => s + effectiveLoanEmi(l), 0)
  const other = data.otherDebts.reduce((s, d) => s + d.emi, 0)
  return home + other
}

export function monthlyInsurancePremium(data: FinanceData): number {
  return data.healthInsurance.reduce((s, p) => {
    return s + (p.frequency === 'monthly' ? p.premium : p.premium / 12)
  }, 0)
}

export function monthlySipTotal(data: FinanceData): number {
  return data.mutualFunds.reduce((s, m) => s + m.monthlySip, 0)
}

export function monthlyCashFlow(data: FinanceData) {
  const income = monthlyIncome(data)
  const expenses = monthlyExpensesTotal(data)
  const emis = monthlyEmiTotal(data)
  const insurance = monthlyInsurancePremium(data)
  const sips = monthlySipTotal(data)
  const outflow = expenses + emis + insurance + sips
  return {
    income,
    expenses,
    emis,
    insurance,
    sips,
    outflow,
    surplus: income - outflow,
    savingsRate: income > 0 ? ((income - expenses - emis - insurance) / income) * 100 : 0,
  }
}

export function totalInvestedCorpus(data: FinanceData): number {
  return stocksValue(data) + fdValue(data) + mfValue(data) + otherAssetsValue(data)
}
