import type { FinanceData } from '@/types/finance'
import { calculateEmi } from './loan'

export interface NetWorthBreakdown {
  stocks: number
  fixedDeposits: number
  mutualFunds: number
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

export function propertyMarketValue(data: FinanceData): number {
  return data.homeLoans.reduce((s, x) => s + x.marketValue, 0)
}

/** Approximate outstanding principal using remaining tenure estimate */
export function homeLoanOutstanding(data: FinanceData): number {
  return data.homeLoans.reduce((sum, loan) => {
    // Simple estimate: use loan amount if no better calc; callers can refine
    const monthsElapsed = monthsBetween(loan.startDate, new Date().toISOString().slice(0, 10))
    const remaining = Math.max(0, loan.tenureMonths - monthsElapsed)
    if (remaining <= 0) return sum
    const emi = calculateEmi(loan.loanAmount, loan.interestRate, loan.tenureMonths)
    // Approximate remaining balance via present value of remaining EMIs
    const r = loan.interestRate / 12 / 100
    if (r === 0) return sum + emi * remaining
    const balance = (emi * (1 - Math.pow(1 + r, -remaining))) / r
    return sum + balance
  }, 0)
}

function monthsBetween(start: string, end: string): number {
  const a = new Date(start)
  const b = new Date(end)
  return Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()))
}

export function otherDebtBalance(data: FinanceData): number {
  return data.otherDebts.reduce((s, x) => s + x.principal, 0)
}

export function calculateNetWorth(data: FinanceData): NetWorthBreakdown {
  const stocks = stocksValue(data)
  const fixedDeposits = fdValue(data)
  const mutualFunds = mfValue(data)
  const property = propertyMarketValue(data)
  const homeLoanBalance = homeLoanOutstanding(data)
  const otherDebt = otherDebtBalance(data)
  const propertyEquity = property - homeLoanBalance
  const totalAssets = stocks + fixedDeposits + mutualFunds + property
  const totalLiabilities = homeLoanBalance + otherDebt

  return {
    stocks,
    fixedDeposits,
    mutualFunds,
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
  const home = data.homeLoans.reduce(
    (s, l) => s + calculateEmi(l.loanAmount, l.interestRate, l.tenureMonths),
    0,
  )
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
  return stocksValue(data) + fdValue(data) + mfValue(data)
}
