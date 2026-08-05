import { z } from 'zod'

export const currencySchema = z.enum(['INR', 'USD', 'EUR', 'GBP'])
export const incomeFrequencySchema = z.enum(['monthly', 'yearly', 'one-time'])
export const premiumFrequencySchema = z.enum(['monthly', 'yearly'])
export const expenseCategorySchema = z.enum([
  'rent',
  'utilities',
  'groceries',
  'transport',
  'healthcare',
  'entertainment',
  'education',
  'subscriptions',
  'dining',
  'other',
])

export const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  age: z.number().int().min(18).max(100),
  currency: currencySchema,
  retirementAge: z.number().int().min(40).max(80),
  onboardingComplete: z.boolean(),
})

export const salarySchema = z.object({
  monthlyInHand: z.number().min(0),
})

export const otherIncomeSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  amount: z.number().min(0),
  frequency: incomeFrequencySchema,
})

export const stockSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  ticker: z.string().optional(),
  quantity: z.number().min(0),
  buyPrice: z.number().min(0),
  currentPrice: z.number().min(0),
})

export const fixedDepositSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  principal: z.number().min(0),
  interestRate: z.number().min(0).max(100),
  startDate: z.string(),
  maturityDate: z.string(),
})

export const mutualFundSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  investedAmount: z.number().min(0),
  currentValue: z.number().min(0),
  monthlySip: z.number().min(0),
})

export const rateChangeSchema = z.object({
  id: z.string(),
  date: z.string(),
  interestRate: z.number().min(0).max(100),
})

export const prepaymentSchema = z.object({
  id: z.string(),
  date: z.string(),
  amount: z.number().min(0),
})

export const homeLoanSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  marketValue: z.number().min(0),
  purchasePrice: z.number().min(0),
  downPayment: z.number().min(0),
  loanAmount: z.number().min(0),
  startDate: z.string(),
  interestRate: z.number().min(0).max(100),
  tenureMonths: z.number().int().min(1).max(600),
  rateChanges: z.array(rateChangeSchema),
  prepayments: z.array(prepaymentSchema),
})

export const otherDebtSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  principal: z.number().min(0),
  interestRate: z.number().min(0).max(100),
  emi: z.number().min(0),
  remainingMonths: z.number().int().min(0),
})

export const healthInsuranceSchema = z.object({
  id: z.string(),
  provider: z.string().min(1),
  coverAmount: z.number().min(0),
  premium: z.number().min(0),
  frequency: premiumFrequencySchema,
  renewalDate: z.string(),
})

export const monthlyExpenseSchema = z.object({
  id: z.string(),
  category: expenseCategorySchema,
  name: z.string().min(1),
  amount: z.number().min(0),
})

export const settingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
})

export const financeDataSchema = z.object({
  version: z.literal(1),
  profile: profileSchema,
  salary: salarySchema,
  otherIncomes: z.array(otherIncomeSchema),
  stocks: z.array(stockSchema),
  fixedDeposits: z.array(fixedDepositSchema),
  mutualFunds: z.array(mutualFundSchema),
  homeLoans: z.array(homeLoanSchema),
  otherDebts: z.array(otherDebtSchema),
  healthInsurance: z.array(healthInsuranceSchema),
  expenses: z.array(monthlyExpenseSchema),
  settings: settingsSchema,
})
