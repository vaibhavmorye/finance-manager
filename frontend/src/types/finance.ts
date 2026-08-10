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

export type InsuranceType = 'health' | 'term'

export type CoveredPerson = 'self' | 'spouse' | 'children' | 'parents'

export type PrepaymentMode = 'reduce_tenure' | 'reduce_emi'
/** one_time = single payment; others repeat from start date until endDate (or loan end). */
export type PrepaymentFrequency =
  | 'one_time'
  | 'monthly'
  | 'quarterly'
  | 'half_yearly'
  | 'annually'
  | 'weekly'
  | 'lump_sum'

export interface Profile {
  name: string
  age: number
  currency: Currency
  retirementAge: number
  onboardingComplete: boolean
}

export interface Salary {
  /** CTC / taxable gross before deductions (monthly). Used for income tax. */
  monthlyGross: number
  /** Take-home after tax & deductions (monthly). Used for cashflow. */
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
  /** Manual adds stay visible alongside tradebook positions. */
  source?: 'manual' | 'tradebook'
}

export interface Trade {
  id: string
  /** Broker trade id — used for dedup across multiple tradebook files */
  tradeId: string
  orderId?: string
  symbol: string
  isin?: string
  tradeDate: string
  exchange?: string
  segment?: string
  series?: string
  tradeType: 'buy' | 'sell'
  auction?: boolean
  quantity: number
  price: number
  orderExecutionTime?: string
  sourceFile?: string
  /**
   * User-marked corporate exit for sells (buyback, open offer, …).
   * Preserved across tradebook re-imports for the same tradeId.
   */
  exitType?: CorporateExitType
}

/** User- or system-tagged reason for an equity exit. */
export type CorporateExitType =
  | 'buyback'
  | 'open_offer'
  | 'delisting'
  | 'merger'
  | 'tender'

export interface FixedDeposit {
  id: string
  name: string
  principal: number
  interestRate: number
  startDate: string
  maturityDate: string
}

/** Goal purpose for a saving pot. */
export type PotPurpose = 'emergency' | 'education' | 'retirement' | 'custom'

/** Funding vehicle linked to a pot. */
export type PotVehicle = 'fd' | 'mf'

/** Accumulate (SIP / deposit) vs withdraw (SWP). */
export type PotPlanMode = 'accumulate' | 'withdraw'

/**
 * Goal-based saving pot — sits above FD / MF holdings.
 * Optional links point at existing investments.
 */
export interface SavingPot {
  id: string
  name: string
  purpose: PotPurpose
  vehicle: PotVehicle
  targetAmount: number
  targetDate?: string
  /** Tracked progress (can sync from linked holding). */
  currentAmount: number
  /** Monthly SIP in (accumulate) or SWP out (withdraw). */
  monthlyAmount: number
  expectedReturnPercent: number
  planMode: PotPlanMode
  /** SWP plan duration in years (when planMode === 'withdraw'). */
  swpYears?: number
  /** Starting corpus for SWP plan. */
  swpCorpus?: number
  linkedFixedDepositId?: string
  linkedMutualFundId?: string
}

/** Equity-oriented vs debt / non-equity for capital-gains treatment. */
export type FundCategory = 'equity' | 'debt'

export interface MutualFund {
  id: string
  name: string
  investedAmount: number
  currentValue: number
  monthlySip: number
  /** Defaults to equity when omitted (legacy). */
  fundCategory?: FundCategory
}

export type MfTransactionType = 'buy' | 'sell' | 'sip'

/**
 * Mutual-fund unit ledger. Shaped for a future CSV/XLSX import
 * (`tradeId` / `sourceFile` for dedup across files).
 */
export interface MfTransaction {
  id: string
  fundId: string
  /** Broker / statement row id — used for dedup across imports */
  tradeId?: string
  date: string
  type: MfTransactionType
  units: number
  nav: number
  /** Optional; defaults to units * nav */
  amount?: number
  sourceFile?: string
}

export interface TaxProfile {
  /** Indian FY start year (e.g. 2025 → FY 2025-26). */
  fyStartYear: number
  section80C: number
  section80D: number
  section80CCD1B: number
  /** Annual basic salary (for HRA exemption). */
  basicSalaryAnnual: number
  hraReceivedAnnual: number
  rentPaidAnnual: number
  isMetro: boolean
  /** Section 24(b) home-loan interest. */
  section24b: number
}

/** Physical / alternative holdings (gold, silver, etc.). */
export type OtherAssetKind = 'gold' | 'silver' | 'other'

export interface OtherAsset {
  id: string
  name: string
  kind: OtherAssetKind
  /** Weight or count (e.g. grams for precious metals). */
  quantity: number
  /** Unit label — typically `g` for gold/silver. */
  unit: string
  buyPrice: number
  currentPrice: number
}

export interface RateChange {
  id: string
  date: string
  interestRate: number
}

export interface Prepayment {
  id: string
  /** Start date (or single payment date for one_time). */
  date: string
  amount: number
  /** Defaults to one_time when omitted (legacy). */
  frequency?: PrepaymentFrequency
  /** Optional end date for recurring schedules. */
  endDate?: string
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
  /** Current EMI — when set, overrides the formula EMI. */
  emi?: number
  /** Principal repaid till now — when set, overrides schedule-based outstanding. */
  amountPaid?: number
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
  type: InsuranceType
  coverAmount: number
  premium: number
  frequency: PremiumFrequency
  renewalDate: string
  peopleCovered: CoveredPerson[]
}

export interface MonthlyExpense {
  id: string
  category: ExpenseCategory
  name: string
  amount: number
}

/** Dated spend event for the cash-flow ledger. */
export interface ExpenseEntry {
  id: string
  category: ExpenseCategory
  name: string
  amount: number
  /** ISO date YYYY-MM-DD */
  date: string
  notes?: string
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
  trades: Trade[]
  fixedDeposits: FixedDeposit[]
  mutualFunds: MutualFund[]
  mfTransactions: MfTransaction[]
  otherAssets: OtherAsset[]
  savingPots: SavingPot[]
  homeLoans: HomeLoan[]
  otherDebts: OtherDebt[]
  healthInsurance: HealthInsurance[]
  /** Recurring monthly budget lines */
  expenses: MonthlyExpense[]
  /** Actual dated spend ledger */
  expenseEntries: ExpenseEntry[]
  taxProfile: TaxProfile
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

export const INSURANCE_TYPE_LABELS: Record<InsuranceType, string> = {
  health: 'Health',
  term: 'Term',
}

export const COVERED_PERSON_LABELS: Record<CoveredPerson, string> = {
  self: 'Self',
  spouse: 'Spouse',
  children: 'Children',
  parents: 'Parents',
}

export const COVERED_PERSON_OPTIONS: CoveredPerson[] = [
  'self',
  'spouse',
  'children',
  'parents',
]

export const OTHER_ASSET_KIND_LABELS: Record<OtherAssetKind, string> = {
  gold: 'Gold',
  silver: 'Silver',
  other: 'Other',
}

export const OTHER_ASSET_KIND_OPTIONS: OtherAssetKind[] = ['gold', 'silver', 'other']

export const FUND_CATEGORY_LABELS: Record<FundCategory, string> = {
  equity: 'Equity',
  debt: 'Debt / other',
}

export const FUND_CATEGORY_OPTIONS: FundCategory[] = ['equity', 'debt']

export const POT_PURPOSE_LABELS: Record<PotPurpose, string> = {
  emergency: 'Emergency fund',
  education: 'Education',
  retirement: 'Retirement',
  custom: 'Custom',
}

export const POT_PURPOSE_OPTIONS: PotPurpose[] = [
  'emergency',
  'education',
  'retirement',
  'custom',
]

export const POT_VEHICLE_LABELS: Record<PotVehicle, string> = {
  fd: 'Fixed deposit',
  mf: 'Mutual fund',
}

export const POT_VEHICLE_OPTIONS: PotVehicle[] = ['fd', 'mf']

export const POT_PLAN_MODE_LABELS: Record<PotPlanMode, string> = {
  accumulate: 'Accumulate',
  withdraw: 'Withdraw (SWP)',
}

export const POT_PLAN_MODE_OPTIONS: PotPlanMode[] = ['accumulate', 'withdraw']

/** Defaults when creating a pot from a purpose template. */
export function potDefaultsForPurpose(purpose: PotPurpose): {
  name: string
  vehicle: PotVehicle
  planMode: PotPlanMode
  expectedReturnPercent: number
} {
  switch (purpose) {
    case 'emergency':
      return {
        name: 'Emergency fund',
        vehicle: 'fd',
        planMode: 'accumulate',
        expectedReturnPercent: 6.5,
      }
    case 'education':
      return {
        name: 'Education',
        vehicle: 'mf',
        planMode: 'accumulate',
        expectedReturnPercent: 12,
      }
    case 'retirement':
      return {
        name: 'Retirement',
        vehicle: 'mf',
        planMode: 'accumulate',
        expectedReturnPercent: 12,
      }
    default:
      return {
        name: 'Custom goal',
        vehicle: 'mf',
        planMode: 'accumulate',
        expectedReturnPercent: 10,
      }
  }
}

export function defaultUnitForKind(kind: OtherAssetKind): string {
  return kind === 'gold' || kind === 'silver' ? 'g' : 'units'
}

/** Current Indian financial-year start year (Apr–Mar). */
export function currentFyStartYear(now = new Date()): number {
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  return m >= 4 ? y : y - 1
}

export function createDefaultTaxProfile(fyStartYear?: number): TaxProfile {
  return {
    fyStartYear: fyStartYear ?? currentFyStartYear(),
    section80C: 0,
    section80D: 0,
    section80CCD1B: 0,
    basicSalaryAnnual: 0,
    hraReceivedAnnual: 0,
    rentPaidAnnual: 0,
    isMetro: true,
    section24b: 0,
  }
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
    salary: { monthlyGross: 0, monthlyInHand: 0 },
    otherIncomes: [],
    stocks: [],
    trades: [],
    fixedDeposits: [],
    mutualFunds: [],
    mfTransactions: [],
    otherAssets: [],
    savingPots: [],
    homeLoans: [],
    otherDebts: [],
    healthInsurance: [],
    expenses: [],
    expenseEntries: [],
    taxProfile: createDefaultTaxProfile(),
    settings: { theme: 'system' },
  }
}

export function createId(): string {
  return crypto.randomUUID()
}
