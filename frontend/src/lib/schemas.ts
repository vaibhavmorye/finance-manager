import { z } from 'zod'

export const currencySchema = z.enum(['INR', 'USD', 'EUR', 'GBP'])
export const incomeFrequencySchema = z.enum(['monthly', 'yearly', 'one-time'])
export const premiumFrequencySchema = z.enum(['monthly', 'yearly'])
export const insuranceTypeSchema = z.enum(['health', 'term'])
export const coveredPersonSchema = z.enum(['self', 'spouse', 'children', 'parents'])
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
  monthlyGross: z.number().min(0).default(0),
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
  source: z.enum(['manual', 'tradebook']).optional(),
})

export const corporateExitTypeSchema = z.enum([
  'buyback',
  'open_offer',
  'delisting',
  'merger',
  'tender',
])

export const tradeSchema = z.object({
  id: z.string(),
  tradeId: z.string(),
  orderId: z.string().optional(),
  symbol: z.string().min(1),
  isin: z.string().optional(),
  tradeDate: z.string(),
  exchange: z.string().optional(),
  segment: z.string().optional(),
  series: z.string().optional(),
  tradeType: z.enum(['buy', 'sell']),
  auction: z.boolean().optional(),
  quantity: z.number().min(0),
  price: z.number().min(0),
  orderExecutionTime: z.string().optional(),
  sourceFile: z.string().optional(),
  exitType: corporateExitTypeSchema.optional(),
})

export const fixedDepositSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  principal: z.number().min(0),
  interestRate: z.number().min(0).max(100),
  startDate: z.string(),
  maturityDate: z.string(),
})

export const potPurposeSchema = z.enum(['emergency', 'education', 'retirement', 'custom'])
export const potVehicleSchema = z.enum(['fd', 'mf'])
export const potPlanModeSchema = z.enum(['accumulate', 'withdraw'])

export const savingPotSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  purpose: potPurposeSchema,
  vehicle: potVehicleSchema,
  targetAmount: z.number().min(0),
  targetDate: z.string().optional(),
  currentAmount: z.number().min(0),
  monthlyAmount: z.number().min(0),
  expectedReturnPercent: z.number().min(0),
  planMode: potPlanModeSchema,
  swpYears: z.number().min(0).optional(),
  swpCorpus: z.number().min(0).optional(),
  linkedFixedDepositId: z.string().optional(),
  linkedMutualFundId: z.string().optional(),
})

export const mutualFundSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  investedAmount: z.number().min(0),
  currentValue: z.number().min(0),
  monthlySip: z.number().min(0),
  fundCategory: z.enum(['equity', 'debt']).default('equity'),
})

export const mfTransactionSchema = z.object({
  id: z.string(),
  fundId: z.string(),
  tradeId: z.string().optional(),
  date: z.string(),
  type: z.enum(['buy', 'sell', 'sip']),
  units: z.number().min(0),
  nav: z.number().min(0),
  amount: z.number().min(0).optional(),
  sourceFile: z.string().optional(),
})

export const taxProfileSchema = z.object({
  fyStartYear: z.number().int(),
  section80C: z.number().min(0).default(0),
  section80D: z.number().min(0).default(0),
  section80CCD1B: z.number().min(0).default(0),
  basicSalaryAnnual: z.number().min(0).default(0),
  hraReceivedAnnual: z.number().min(0).default(0),
  rentPaidAnnual: z.number().min(0).default(0),
  isMetro: z.boolean().default(true),
  section24b: z.number().min(0).default(0),
})

export const otherAssetKindSchema = z.enum(['gold', 'silver', 'other'])

export const otherAssetSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  kind: otherAssetKindSchema,
  quantity: z.number().min(0),
  unit: z.string().min(1),
  buyPrice: z.number().min(0),
  currentPrice: z.number().min(0),
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
  frequency: z
    .enum(['one_time', 'monthly', 'quarterly', 'half_yearly', 'annually', 'weekly', 'lump_sum'])
    .optional(),
  endDate: z.string().optional(),
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
  emi: z.number().min(0).optional(),
  amountPaid: z.number().min(0).optional(),
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
  type: insuranceTypeSchema.default('health'),
  coverAmount: z.number().min(0),
  premium: z.number().min(0),
  frequency: premiumFrequencySchema,
  renewalDate: z.string(),
  peopleCovered: z.array(coveredPersonSchema).default([]),
})

export const monthlyExpenseSchema = z.object({
  id: z.string(),
  category: expenseCategorySchema,
  name: z.string().min(1),
  amount: z.number().min(0),
})

export const expenseEntrySchema = z.object({
  id: z.string(),
  category: expenseCategorySchema,
  name: z.string().min(1),
  amount: z.number().min(0),
  date: z.string(),
  notes: z.string().optional(),
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
  trades: z.array(tradeSchema).default([]),
  fixedDeposits: z.array(fixedDepositSchema),
  mutualFunds: z.array(mutualFundSchema),
  mfTransactions: z.array(mfTransactionSchema).default([]),
  otherAssets: z.array(otherAssetSchema).default([]),
  savingPots: z.array(savingPotSchema).default([]),
  homeLoans: z.array(homeLoanSchema),
  otherDebts: z.array(otherDebtSchema),
  healthInsurance: z.array(healthInsuranceSchema),
  expenses: z.array(monthlyExpenseSchema),
  expenseEntries: z.array(expenseEntrySchema).default([]),
  taxProfile: taxProfileSchema.optional(),
  settings: settingsSchema,
}).transform((data) => {
  const { taxProfile, ...rest } = data
  const fy =
    taxProfile?.fyStartYear ??
    (() => {
      const now = new Date()
      const y = now.getFullYear()
      const m = now.getMonth() + 1
      return m >= 4 ? y : y - 1
    })()
  return {
    ...rest,
    taxProfile: {
      fyStartYear: fy,
      section80C: taxProfile?.section80C ?? 0,
      section80D: taxProfile?.section80D ?? 0,
      section80CCD1B: taxProfile?.section80CCD1B ?? 0,
      basicSalaryAnnual: taxProfile?.basicSalaryAnnual ?? 0,
      hraReceivedAnnual: taxProfile?.hraReceivedAnnual ?? 0,
      rentPaidAnnual: taxProfile?.rentPaidAnnual ?? 0,
      isMetro: taxProfile?.isMetro ?? true,
      section24b: taxProfile?.section24b ?? 0,
    },
  }
})
