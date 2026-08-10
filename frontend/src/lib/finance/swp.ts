export type SwpCalcMode = 'sustainability' | 'required_corpus'

/** How to interpret monthlyWithdrawal when withdrawals are deferred. */
export type SwpWithdrawalBasis = 'today' | 'at_start'

export interface SwpInput {
  mode: SwpCalcMode
  /** Starting corpus (sustainability mode) — value today. */
  corpus?: number
  monthlyWithdrawal: number
  annualReturnPercent: number
  /** Years of systematic withdrawals after SWP begins. */
  years: number
  /** Increase monthly withdrawal by this % each year during SWP (and while deferred if basis is today). */
  annualStepUpPercent?: number
  /** Years before withdrawals begin; corpus grows with no draws. */
  yearsUntilStart?: number
  /**
   * When yearsUntilStart > 0:
   * - today: monthlyWithdrawal is today's rupees; grown by step-up until SWP starts
   * - at_start: monthlyWithdrawal is the first SWP month's withdrawal as entered
   */
  withdrawalBasis?: SwpWithdrawalBasis
}

export interface SwpYearPoint {
  year: number
  corpus: number
  totalWithdrawn: number
  /** Whether this point is still in the pre-withdrawal growth phase. */
  accumulating?: boolean
}

export interface SwpResult {
  /** Ending corpus after full horizon (0 if depleted earlier). */
  endingCorpus: number
  totalWithdrawn: number
  /** Months from today until corpus hits zero; null if it lasts the full horizon. */
  monthsUntilDeplete: number | null
  sustainable: boolean
  /** Corpus needed today so the plan lasts (discounted if start is deferred). */
  requiredCorpus: number
  /** Corpus needed at the moment withdrawals begin. */
  requiredCorpusAtStart: number
  /** First monthly withdrawal when SWP begins. */
  startingMonthlyWithdrawal: number
  yearsUntilStart: number
  projection: SwpYearPoint[]
}

/** Present value of an annuity-due (withdraw at start of each month). */
function pvOfAnnuityDue(pmt: number, monthlyRate: number, months: number): number {
  if (pmt <= 0 || months <= 0) return 0
  if (Math.abs(monthlyRate) < 1e-12) return pmt * months
  return pmt * ((1 - Math.pow(1 + monthlyRate, -months)) / monthlyRate) * (1 + monthlyRate)
}

function discountCorpus(corpus: number, annualReturnPercent: number, years: number): number {
  if (years <= 0 || corpus <= 0) return corpus
  const months = Math.round(years * 12)
  const monthlyRate = annualReturnPercent / 12 / 100
  if (Math.abs(monthlyRate) < 1e-12) return corpus
  return corpus / Math.pow(1 + monthlyRate, months)
}

/**
 * First monthly withdrawal when SWP begins, given today's input and deferral.
 */
export function startingWithdrawalAmount(
  monthlyWithdrawal: number,
  yearsUntilStart: number,
  annualStepUpPercent: number,
  withdrawalBasis: SwpWithdrawalBasis,
): number {
  if (monthlyWithdrawal <= 0) return 0
  if (yearsUntilStart <= 0 || withdrawalBasis === 'at_start') return monthlyWithdrawal
  return monthlyWithdrawal * Math.pow(1 + annualStepUpPercent / 100, yearsUntilStart)
}

/**
 * Required corpus so monthly withdrawals last exactly `years`
 * with monthly compounding returns (annuity-due: withdraw at start of month).
 * Withdrawals may step up by `annualStepUpPercent` each year.
 * This is the corpus needed at the start of the withdrawal phase.
 */
export function requiredCorpusForSwp(
  monthlyWithdrawal: number,
  annualReturnPercent: number,
  years: number,
  annualStepUpPercent = 0,
): number {
  if (monthlyWithdrawal <= 0 || years <= 0) return 0
  const months = Math.round(years * 12)
  const r = annualReturnPercent / 12 / 100

  if (Math.abs(annualStepUpPercent) < 1e-12) {
    return pvOfAnnuityDue(monthlyWithdrawal, r, months)
  }

  // Sum PV of each year's (or partial final year) fixed monthly block.
  let totalPv = 0
  let withdrawal = monthlyWithdrawal
  let month = 0
  while (month < months) {
    const monthsInBlock = Math.min(12, months - month)
    const pvAtBlockStart = pvOfAnnuityDue(withdrawal, r, monthsInBlock)
    const pvAtT0 =
      Math.abs(r) < 1e-12 ? pvAtBlockStart : pvAtBlockStart / Math.pow(1 + r, month)
    totalPv += pvAtT0
    month += monthsInBlock
    withdrawal *= 1 + annualStepUpPercent / 100
  }
  return totalPv
}

function simulateGrowthPhase(
  startCorpus: number,
  annualReturnPercent: number,
  yearsUntilStart: number,
  projection: SwpYearPoint[],
): number {
  const months = Math.max(0, Math.round(yearsUntilStart * 12))
  if (months === 0) return startCorpus

  const monthlyRate = annualReturnPercent / 12 / 100
  let corpus = startCorpus

  for (let m = 1; m <= months; m++) {
    corpus *= 1 + monthlyRate
    if (m % 12 === 0 || m === months) {
      projection.push({
        year: m / 12,
        corpus,
        totalWithdrawn: 0,
        accumulating: true,
      })
    }
  }
  return corpus
}

function simulateSwpPhase(
  startCorpus: number,
  monthlyWithdrawal: number,
  annualReturnPercent: number,
  years: number,
  annualStepUpPercent: number,
  yearOffset: number,
  projection: SwpYearPoint[],
): {
  endingCorpus: number
  totalWithdrawn: number
  monthsUntilDeplete: number | null
} {
  const months = Math.max(0, Math.round(years * 12))
  const monthlyRate = annualReturnPercent / 12 / 100
  const offsetMonths = Math.round(yearOffset * 12)
  let corpus = startCorpus
  let totalWithdrawn = 0
  let currentWithdrawal = monthlyWithdrawal
  let monthsUntilDeplete: number | null = null

  for (let m = 1; m <= months; m++) {
    if (corpus < 1e-6) {
      corpus = 0
      if (monthsUntilDeplete == null && m < months) {
        monthsUntilDeplete = offsetMonths + m - 1
      }
      break
    }
    const withdraw = Math.min(currentWithdrawal, corpus)
    corpus -= withdraw
    totalWithdrawn += withdraw
    if (corpus > 0) {
      corpus *= 1 + monthlyRate
    }
    if (corpus < 1e-6) {
      corpus = 0
      if (monthsUntilDeplete == null && m < months) {
        monthsUntilDeplete = offsetMonths + m
      }
    }
    if (m % 12 === 0 || m === months) {
      projection.push({
        year: yearOffset + m / 12,
        corpus,
        totalWithdrawn,
        accumulating: false,
      })
    }
    if (m % 12 === 0 && m < months) {
      currentWithdrawal *= 1 + annualStepUpPercent / 100
    }
  }

  return {
    endingCorpus: Math.max(0, corpus),
    totalWithdrawn,
    monthsUntilDeplete,
  }
}

export function calculateSwp(input: SwpInput): SwpResult {
  const {
    mode,
    monthlyWithdrawal,
    annualReturnPercent,
    years,
    annualStepUpPercent = 0,
    yearsUntilStart = 0,
    withdrawalBasis = 'today',
  } = input

  const deferYears = Math.max(0, yearsUntilStart)
  const startingMonthlyWithdrawal = startingWithdrawalAmount(
    monthlyWithdrawal,
    deferYears,
    annualStepUpPercent,
    withdrawalBasis,
  )

  const requiredCorpusAtStart = requiredCorpusForSwp(
    startingMonthlyWithdrawal,
    annualReturnPercent,
    years,
    annualStepUpPercent,
  )
  // Small buffer so floating-point / end-of-term rounding doesn't mark as failed
  const requiredCorpusAtStartBuffered = requiredCorpusAtStart * 1.0001
  const requiredCorpusToday =
    discountCorpus(requiredCorpusAtStartBuffered, annualReturnPercent, deferYears)

  const startCorpusToday =
    mode === 'required_corpus' ? requiredCorpusToday : (input.corpus ?? 0)

  const projection: SwpYearPoint[] = [
    { year: 0, corpus: startCorpusToday, totalWithdrawn: 0, accumulating: deferYears > 0 },
  ]

  const corpusAtSwpStart = simulateGrowthPhase(
    startCorpusToday,
    annualReturnPercent,
    deferYears,
    projection,
  )

  const sim = simulateSwpPhase(
    corpusAtSwpStart,
    startingMonthlyWithdrawal,
    annualReturnPercent,
    years,
    annualStepUpPercent,
    deferYears,
    projection,
  )

  return {
    endingCorpus: sim.endingCorpus,
    totalWithdrawn: sim.totalWithdrawn,
    monthsUntilDeplete: sim.monthsUntilDeplete,
    sustainable: sim.monthsUntilDeplete == null,
    requiredCorpus: requiredCorpusToday,
    requiredCorpusAtStart: requiredCorpusAtStartBuffered,
    startingMonthlyWithdrawal,
    yearsUntilStart: deferYears,
    projection,
  }
}
