export type CompoundingFrequency = 'monthly' | 'quarterly' | 'yearly' | 'simple'

export type InterestCalcMode = 'maturity' | 'required_principal' | 'recurring'

export interface InterestInput {
  mode: InterestCalcMode
  /** Principal for maturity / recurring modes. */
  principal?: number
  /** Target maturity for required_principal mode. */
  targetMaturity?: number
  annualRatePercent: number
  years: number
  months?: number
  compounding: CompoundingFrequency
  /** Monthly deposit for recurring mode. */
  monthlyDeposit?: number
}

export interface InterestYearPoint {
  year: number
  invested: number
  value: number
  interest: number
}

export interface InterestResult {
  maturityValue: number
  totalInvested: number
  interestEarned: number
  /** Principal needed to reach target (required_principal mode). */
  requiredPrincipal?: number
  effectiveAnnualYieldPercent: number
  tenureMonths: number
  projection: InterestYearPoint[]
}

function tenureMonths(years: number, months = 0): number {
  return Math.max(0, Math.round(years * 12 + months))
}

function periodsPerYear(compounding: CompoundingFrequency): number | null {
  switch (compounding) {
    case 'monthly':
      return 12
    case 'quarterly':
      return 4
    case 'yearly':
      return 1
    case 'simple':
      return null
  }
}

/** Compound / simple maturity of a lump sum over `nMonths`. */
export function lumpSumMaturity(
  principal: number,
  annualRatePercent: number,
  nMonths: number,
  compounding: CompoundingFrequency,
): number {
  if (principal <= 0 || nMonths <= 0) return Math.max(0, principal)
  const years = nMonths / 12
  const r = annualRatePercent / 100
  const n = periodsPerYear(compounding)
  if (n == null) {
    return principal * (1 + r * years)
  }
  return principal * Math.pow(1 + r / n, n * years)
}

/** Required principal so maturity equals `target` after `nMonths`. */
export function requiredPrincipalForTarget(
  target: number,
  annualRatePercent: number,
  nMonths: number,
  compounding: CompoundingFrequency,
): number {
  if (target <= 0 || nMonths <= 0) return Math.max(0, target)
  const years = nMonths / 12
  const r = annualRatePercent / 100
  const n = periodsPerYear(compounding)
  if (n == null) {
    const denom = 1 + r * years
    return denom > 0 ? target / denom : target
  }
  const factor = Math.pow(1 + r / n, n * years)
  return factor > 0 ? target / factor : target
}

/**
 * Recurring deposit simulation (monthly deposits).
 * Growth uses monthly compounding for chart consistency; `compounding: 'simple'`
 * applies a half-tenure simple-interest approximation at each snapshot (common RD rule of thumb).
 */
function simulateRecurring(
  principal: number,
  monthlyDeposit: number,
  annualRatePercent: number,
  nMonths: number,
  compounding: CompoundingFrequency,
): { value: number; invested: number; projection: InterestYearPoint[] } {
  const monthlyRate = annualRatePercent / 12 / 100
  let balance = principal
  let invested = principal
  const projection: InterestYearPoint[] = [
    { year: 0, invested, value: balance, interest: balance - invested },
  ]

  for (let m = 1; m <= nMonths; m++) {
    invested += monthlyDeposit
    if (compounding === 'simple') {
      const years = m / 12
      // Rule of thumb: interest ≈ rate × total deposits × half tenure
      balance = invested * (1 + (annualRatePercent / 100) * years * 0.5)
    } else {
      balance = (balance + monthlyDeposit) * (1 + monthlyRate)
    }

    if (m % 12 === 0 || m === nMonths) {
      const year = m / 12
      projection.push({
        year,
        invested,
        value: balance,
        interest: balance - invested,
      })
    }
  }

  return { value: balance, invested, projection }
}

function projectionForLumpSum(
  principal: number,
  annualRatePercent: number,
  nMonths: number,
  compounding: CompoundingFrequency,
): InterestYearPoint[] {
  const yearsTotal = nMonths / 12
  const wholeYears = Math.floor(yearsTotal)
  const projection: InterestYearPoint[] = [
    { year: 0, invested: principal, value: principal, interest: 0 },
  ]
  for (let y = 1; y <= wholeYears; y++) {
    const value = lumpSumMaturity(principal, annualRatePercent, y * 12, compounding)
    projection.push({
      year: y,
      invested: principal,
      value,
      interest: value - principal,
    })
  }
  if (nMonths > 0 && nMonths % 12 !== 0) {
    const value = lumpSumMaturity(principal, annualRatePercent, nMonths, compounding)
    projection.push({
      year: yearsTotal,
      invested: principal,
      value,
      interest: value - principal,
    })
  }
  return projection
}

export function calculateInterest(input: InterestInput): InterestResult {
  const {
    mode,
    annualRatePercent,
    years,
    months = 0,
    compounding,
    monthlyDeposit = 0,
  } = input
  const nMonths = tenureMonths(years, months)
  const yearsExact = nMonths / 12

  let maturityValue = 0
  let totalInvested = 0
  let requiredPrincipal: number | undefined
  let projection: InterestYearPoint[] = []

  if (mode === 'required_principal') {
    const target = input.targetMaturity ?? 0
    requiredPrincipal = requiredPrincipalForTarget(
      target,
      annualRatePercent,
      nMonths,
      compounding,
    )
    maturityValue = target
    totalInvested = requiredPrincipal
    projection = projectionForLumpSum(
      requiredPrincipal,
      annualRatePercent,
      nMonths,
      compounding,
    )
  } else if (mode === 'recurring') {
    const principal = input.principal ?? 0
    const sim = simulateRecurring(
      principal,
      monthlyDeposit,
      annualRatePercent,
      nMonths,
      compounding,
    )
    maturityValue = sim.value
    totalInvested = sim.invested
    projection = sim.projection
  } else {
    const principal = input.principal ?? 0
    maturityValue = lumpSumMaturity(principal, annualRatePercent, nMonths, compounding)
    totalInvested = principal
    projection = projectionForLumpSum(principal, annualRatePercent, nMonths, compounding)
  }

  const interestEarned = maturityValue - totalInvested
  const effectiveAnnualYieldPercent =
    totalInvested > 0 && yearsExact > 0 && maturityValue > 0
      ? (Math.pow(maturityValue / totalInvested, 1 / yearsExact) - 1) * 100
      : 0

  return {
    maturityValue,
    totalInvested,
    interestEarned,
    requiredPrincipal,
    effectiveAnnualYieldPercent: Number.isFinite(effectiveAnnualYieldPercent)
      ? effectiveAnnualYieldPercent
      : 0,
    tenureMonths: nMonths,
    projection,
  }
}

/** Add months to an ISO date (YYYY-MM-DD). */
export function addMonthsIso(startIso: string, monthsToAdd: number): string {
  const [ys, ms, ds] = startIso.split('-').map(Number)
  const d = new Date(ys, (ms || 1) - 1, ds || 1)
  d.setMonth(d.getMonth() + monthsToAdd)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayIso(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
