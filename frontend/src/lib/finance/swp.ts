export type SwpCalcMode = 'sustainability' | 'required_corpus'

export interface SwpInput {
  mode: SwpCalcMode
  /** Starting corpus (sustainability mode). */
  corpus?: number
  monthlyWithdrawal: number
  annualReturnPercent: number
  years: number
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

/**
 * Required corpus so a fixed monthly withdrawal lasts exactly `years`
 * with monthly compounding returns (annuity-due: withdraw at start of month).
 */
export function requiredCorpusForSwp(
  monthlyWithdrawal: number,
  annualReturnPercent: number,
  years: number,
): number {
  if (monthlyWithdrawal <= 0 || years <= 0) return 0
  const months = Math.round(years * 12)
  const r = annualReturnPercent / 12 / 100
  if (Math.abs(r) < 1e-12) {
    return monthlyWithdrawal * months
  }
  // PV of annuity-due: PMT + PMT * (1 - (1+r)^-(n-1)) / r
  // Equivalent: PMT * (1 - (1+r)^-n) / r * (1+r)
  return monthlyWithdrawal * ((1 - Math.pow(1 + r, -months)) / r) * (1 + r)
}

function simulateSwp(
  startCorpus: number,
  monthlyWithdrawal: number,
  annualReturnPercent: number,
  years: number,
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
    const withdraw = Math.min(monthlyWithdrawal, corpus)
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
  }

  return { endingCorpus: Math.max(0, corpus), totalWithdrawn, monthsUntilDeplete, projection }
}

export function calculateSwp(input: SwpInput): SwpResult {
  const { mode, monthlyWithdrawal, annualReturnPercent, years } = input
  // Small buffer so floating-point / end-of-term rounding doesn't mark as failed
  const requiredCorpus =
    requiredCorpusForSwp(monthlyWithdrawal, annualReturnPercent, years) * 1.0001

  const startCorpus =
    mode === 'required_corpus' ? requiredCorpus : (input.corpus ?? 0)

  const sim = simulateSwp(startCorpus, monthlyWithdrawal, annualReturnPercent, years)
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
