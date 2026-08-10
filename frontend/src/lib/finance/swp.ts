export type SwpCalcMode = 'sustainability' | 'required_corpus'

export interface SwpInput {
  mode: SwpCalcMode
  /** Starting corpus (sustainability mode). */
  corpus?: number
  monthlyWithdrawal: number
  annualReturnPercent: number
  years: number
  /** Increase monthly withdrawal by this % each year (like SIP step-up). */
  annualStepUpPercent?: number
}

export interface SwpYearPoint {
  year: number
  corpus: number
  totalWithdrawn: number
}

export interface SwpResult {
  /** Ending corpus after `years` (0 if depleted earlier). */
  endingCorpus: number
  totalWithdrawn: number
  /** Months until corpus hits zero; null if it lasts the full horizon. */
  monthsUntilDeplete: number | null
  sustainable: boolean
  /** Corpus needed so withdrawals last `years` (required_corpus / also reported in sustainability). */
  requiredCorpus: number
  projection: SwpYearPoint[]
}

/** Present value of an annuity-due (withdraw at start of each month). */
function pvOfAnnuityDue(pmt: number, monthlyRate: number, months: number): number {
  if (pmt <= 0 || months <= 0) return 0
  if (Math.abs(monthlyRate) < 1e-12) return pmt * months
  return pmt * ((1 - Math.pow(1 + monthlyRate, -months)) / monthlyRate) * (1 + monthlyRate)
}

/**
 * Required corpus so monthly withdrawals last exactly `years`
 * with monthly compounding returns (annuity-due: withdraw at start of month).
 * Withdrawals may step up by `annualStepUpPercent` each year.
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

function simulateSwp(
  startCorpus: number,
  monthlyWithdrawal: number,
  annualReturnPercent: number,
  years: number,
  annualStepUpPercent = 0,
): {
  endingCorpus: number
  totalWithdrawn: number
  monthsUntilDeplete: number | null
  projection: SwpYearPoint[]
} {
  const months = Math.max(0, Math.round(years * 12))
  const monthlyRate = annualReturnPercent / 12 / 100
  let corpus = startCorpus
  let totalWithdrawn = 0
  let currentWithdrawal = monthlyWithdrawal
  let monthsUntilDeplete: number | null = null
  const projection: SwpYearPoint[] = [
    { year: 0, corpus, totalWithdrawn: 0 },
  ]

  for (let m = 1; m <= months; m++) {
    if (corpus < 1e-6) {
      corpus = 0
      // Depleting on/after the final month still counts as lasting the full term
      if (monthsUntilDeplete == null && m < months) {
        monthsUntilDeplete = m - 1
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
        monthsUntilDeplete = m
      }
    }
    if (m % 12 === 0 || m === months) {
      projection.push({
        year: m / 12,
        corpus,
        totalWithdrawn,
      })
    }
    // Step up withdrawal at each completed year (before the next year's draws).
    if (m % 12 === 0 && m < months) {
      currentWithdrawal *= 1 + annualStepUpPercent / 100
    }
  }

  return { endingCorpus: Math.max(0, corpus), totalWithdrawn, monthsUntilDeplete, projection }
}

export function calculateSwp(input: SwpInput): SwpResult {
  const {
    mode,
    monthlyWithdrawal,
    annualReturnPercent,
    years,
    annualStepUpPercent = 0,
  } = input
  // Small buffer so floating-point / end-of-term rounding doesn't mark as failed
  const requiredCorpus =
    requiredCorpusForSwp(
      monthlyWithdrawal,
      annualReturnPercent,
      years,
      annualStepUpPercent,
    ) * 1.0001

  const startCorpus =
    mode === 'required_corpus' ? requiredCorpus : (input.corpus ?? 0)

  const sim = simulateSwp(
    startCorpus,
    monthlyWithdrawal,
    annualReturnPercent,
    years,
    annualStepUpPercent,
  )
  const lastsFullTerm = sim.monthsUntilDeplete == null

  return {
    endingCorpus: sim.endingCorpus,
    totalWithdrawn: sim.totalWithdrawn,
    monthsUntilDeplete: sim.monthsUntilDeplete,
    sustainable: lastsFullTerm,
    requiredCorpus,
    projection: sim.projection,
  }
}
