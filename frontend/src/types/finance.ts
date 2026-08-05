export type Currency = 'INR' | 'USD' | 'EUR' | 'GBP'

export type IncomeFrequency = 'monthly' | 'yearly' | 'one-time'

export type ExpenseCategory =
  | 'rent'
  | 'utilities'
  | 'groceries'
  | 'transport'
  | 'healthcare'
  | 'entertainment'
  | 'education'
  | 'subscriptions'
  | 'dining'
  | 'other'

export type PremiumFrequency = 'monthly' | 'yearly'

export type PrepaymentMode = 'reduce_tenure' | 'reduce_emi'
export type PrepaymentFrequency = 'monthly' | 'weekly' | 'lump_sum'

export interface Profile {
  name: string
  age: number
  currency: Currency
  retirementAge: number
  onboardingComplete: boolean
}

export interface Salary {
  monthlyInHand: number
}

export interface OtherIncome {
  id: string
  name: string
  amount: number
  frequency: IncomeFrequency
}

export interface Stock {
  id: string
  name: string
  ticker?: string
  quantity: number
  buyPrice: number
  currentPrice: number
}

export interface FixedDeposit {
  id: string
  name: string
  principal: number
  interestRate: number
  startDate: string
  maturityDate: string
}

export interface MutualFund {
  id: string
  name: string
  investedAmount: number
  currentValue: number
  monthlySip: number
}

export interface RateChange {
  id: string
  date: string
  interestRate: number
}

export interface Prepayment {
  id: string
  date: string
  amount: number
}

export interface HomeLoan {
  id: string
  name: string
  marketValue: number
  purchasePrice: number
  downPayment: number
  loanAmount: number
  startDate: string
  interestRate: number
  tenureMonths: number
  rateChanges: RateChange[]
  prepayments: Prepayment[]
}

export interface OtherDebt {
  id: string
  name: string
  principal: number
  interestRate: number
  emi: number
  remainingMonths: number
}

export interface HealthInsurance {
  id: string
  provider: string
  coverAmount: number
  premium: number
  frequency: PremiumFrequency
  renewalDate: string
}

export interface MonthlyExpense {
  id: string
  category: ExpenseCategory
  name: string
  amount: number
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
}

export interface FinanceData {
  version: 1
  profile: Profile
  salary: Salary
  otherIncomes: OtherIncome[]
  stocks: Stock[]
  fixedDeposits: FixedDeposit[]
  mutualFunds: MutualFund[]
  homeLoans: HomeLoan[]
  otherDebts: OtherDebt[]
  healthInsurance: HealthInsurance[]
  expenses: MonthlyExpense[]
  settings: AppSettings
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  rent: 'Rent / Housing',
  utilities: 'Utilities',
  groceries: 'Groceries',
  transport: 'Transport',
  healthcare: 'Healthcare',
  entertainment: 'Entertainment',
  education: 'Education',
  subscriptions: 'Subscriptions',
  dining: 'Dining Out',
  other: 'Other',
}

export function createDefaultData(): FinanceData {
  return {
    version: 1,
    profile: {
      name: '',
      age: 30,
      currency: 'INR',
      retirementAge: 60,
      onboardingComplete: false,
    },
    salary: { monthlyInHand: 0 },
    otherIncomes: [],
    stocks: [],
    fixedDeposits: [],
    mutualFunds: [],
    homeLoans: [],
    otherDebts: [],
    healthInsurance: [],
    expenses: [],
    settings: { theme: 'system' },
  }
}

export function createId(): string {
  return crypto.randomUUID()
}
