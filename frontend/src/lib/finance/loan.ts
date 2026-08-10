export interface AmortizationRow {
  month: number
  date: string
  emi: number
  principal: number
  interest: number
  balance: number
  prepayment: number
  rate: number
}

export interface LoanInput {
  principal: number
  annualRate: number
  tenureMonths: number
  startDate: string
  /** Fixed EMI override (e.g. bank EMI after rate change). */
  emiOverride?: number
  rateChanges?: { date: string; interestRate: number }[]
  prepayments?: Array<{
    date: string
    amount: number
    frequency?: PrepaymentFrequency
    endDate?: string
  }>
}

export type PrepaymentMode = 'reduce_tenure' | 'reduce_emi'
export type PrepaymentFrequency =
  | 'one_time'
  | 'monthly'
  | 'quarterly'
  | 'half_yearly'
  | 'annually'
  | 'weekly'
  | 'lump_sum'

export interface PrepaymentPlanInput extends LoanInput {
  extraAmount: number
  frequency: PrepaymentFrequency
  mode: PrepaymentMode
  startAfterMonths?: number
}

export interface LoanSummary {
  emi: number
  totalInterest: number
  totalPayment: number
  schedule: AmortizationRow[]
}

export interface PrepaymentComparison {
  baseline: LoanSummary
  withPrepayment: LoanSummary
  interestSaved: number
  monthsSaved: number
  newEmi: number
}

/** Months between recurring prepayments. null = not a month-based interval. */
export function frequencyIntervalMonths(frequency: PrepaymentFrequency): number | null {
  switch (frequency) {
    case 'monthly':
      return 1
    case 'quarterly':
      return 3
    case 'half_yearly':
      return 6
    case 'annually':
      return 12
    default:
      return null
  }
}

export function frequencyLabel(frequency: PrepaymentFrequency): string {
  switch (frequency) {
    case 'one_time':
    case 'lump_sum':
      return 'One-time'
    case 'monthly':
      return 'Monthly'
    case 'quarterly':
      return 'Quarterly'
    case 'half_yearly':
      return 'Half-yearly'
    case 'annually':
      return 'Annually'
    case 'weekly':
      return 'Weekly'
  }
}

/** Standard EMI formula */
export function calculateEmi(principal: number, annualRate: number, tenureMonths: number): number {
  if (principal <= 0 || tenureMonths <= 0) return 0
  if (annualRate === 0) return principal / tenureMonths
  const r = annualRate / 12 / 100
  const factor = Math.pow(1 + r, tenureMonths)
  return (principal * r * factor) / (factor - 1)
}

export function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setMonth(d.getMonth() + months)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function rateAtDate(
  baseRate: number,
  date: string,
  rateChanges: { date: string; interestRate: number }[],
): number {
  let rate = baseRate
  const sorted = [...rateChanges].sort((a, b) => a.date.localeCompare(b.date))
  for (const change of sorted) {
    if (change.date <= date) rate = change.interestRate
  }
  return rate
}

/**
 * Expand scheduled / one-time prepayments into dated amounts within [loanStart, horizonEnd].
 * Weekly is approximated as 4× amount each month.
 */
export function expandPrepayments(
  prepayments: Array<{
    date: string
    amount: number
    frequency?: PrepaymentFrequency
    endDate?: string
  }>,
  horizonEnd: string,
): { date: string; amount: number }[] {
  const out: { date: string; amount: number }[] = []

  for (const p of prepayments) {
    if (p.amount <= 0) continue
    const freq = p.frequency ?? 'one_time'

    if (freq === 'one_time' || freq === 'lump_sum') {
      if (p.date <= horizonEnd) out.push({ date: p.date, amount: p.amount })
      continue
    }

    if (freq === 'weekly') {
      const end = p.endDate && p.endDate < horizonEnd ? p.endDate : horizonEnd
      let cursor = p.date
      let guard = 0
      while (cursor <= end && guard < 1200) {
        out.push({ date: cursor, amount: p.amount * 4 })
        cursor = addMonths(cursor, 1)
        guard++
      }
      continue
    }

    const interval = frequencyIntervalMonths(freq)
    if (!interval) continue

    const end = p.endDate && p.endDate < horizonEnd ? p.endDate : horizonEnd
    let cursor = p.date
    let guard = 0
    while (cursor <= end && guard < 600) {
      out.push({ date: cursor, amount: p.amount })
      cursor = addMonths(cursor, interval)
      guard++
    }
  }

  return out
}

function prepaymentAtDate(
  date: string,
  prepayments: { date: string; amount: number }[],
): number {
  return prepayments
    .filter((p) => p.date === date || p.date.slice(0, 7) === date.slice(0, 7))
    .reduce((sum, p) => sum + p.amount, 0)
}

export function generateAmortization(input: LoanInput): LoanSummary {
  const {
    principal,
    annualRate,
    tenureMonths,
    startDate,
    emiOverride,
    rateChanges = [],
    prepayments = [],
  } = input

  const horizonEnd = addMonths(startDate, tenureMonths + 600)
  const expanded = expandPrepayments(prepayments, horizonEnd)
  const fixedEmi = emiOverride != null && emiOverride > 0 ? emiOverride : null

  let balance = principal
  let currentRate = annualRate
  let emi = fixedEmi ?? calculateEmi(principal, annualRate, tenureMonths)
  const schedule: AmortizationRow[] = []
  let totalInterest = 0
  let month = 0

  while (balance > 0.5 && month < tenureMonths + 600) {
    month++
    const date = addMonths(startDate, month - 1)
    const rate = rateAtDate(annualRate, date, rateChanges)

    if (rate !== currentRate) {
      currentRate = rate
      if (fixedEmi == null) {
        const remaining = tenureMonths - month + 1
        if (remaining > 0) {
          emi = calculateEmi(balance, currentRate, remaining)
        }
      }
    }

    const monthlyRate = currentRate / 12 / 100
    const interest = balance * monthlyRate
    let principalPaid = Math.min(emi - interest, balance)
    if (principalPaid < 0) principalPaid = 0

    let payment = principalPaid + interest
    const prepay = Math.min(prepaymentAtDate(date, expanded), balance - principalPaid)
    balance = Math.max(0, balance - principalPaid - prepay)
    totalInterest += interest

    schedule.push({
      month,
      date,
      emi: payment,
      principal: principalPaid,
      interest,
      balance,
      prepayment: prepay,
      rate: currentRate,
    })

    if (balance <= 0.5) break
  }

  return {
    emi: fixedEmi ?? schedule[0]?.emi ?? emi,
    totalInterest,
    totalPayment: principal + totalInterest,
    schedule,
  }
}

function plannedExtraForMonth(
  frequency: PrepaymentFrequency,
  extraAmount: number,
  monthIndex: number,
  startAfter: number,
): number {
  if (monthIndex <= startAfter || extraAmount <= 0) return 0
  if (frequency === 'weekly') return extraAmount * 4
  if (frequency === 'one_time' || frequency === 'lump_sum') {
    return monthIndex === startAfter + 1 ? extraAmount : 0
  }
  const interval = frequencyIntervalMonths(frequency)
  if (!interval) return 0
  const offset = monthIndex - startAfter - 1
  return offset % interval === 0 ? extraAmount : 0
}

export function calculatePrepaymentPlan(input: PrepaymentPlanInput): PrepaymentComparison {
  const baseline = generateAmortization(input)
  const startAfter = input.startAfterMonths ?? 0

  if (input.mode === 'reduce_tenure') {
    const syntheticPrepayments = [...(input.prepayments ?? [])]
    const freq = input.frequency

    for (let m = startAfter; m < input.tenureMonths + 600; m++) {
      const amount = plannedExtraForMonth(freq, input.extraAmount, m + 1, startAfter)
      if (amount <= 0) continue
      syntheticPrepayments.push({ date: addMonths(input.startDate, m), amount })
    }

    const withPrepayment = generateAmortization({
      ...input,
      prepayments: syntheticPrepayments,
    })

    return {
      baseline,
      withPrepayment,
      interestSaved: baseline.totalInterest - withPrepayment.totalInterest,
      monthsSaved: baseline.schedule.length - withPrepayment.schedule.length,
      newEmi: withPrepayment.emi,
    }
  }

  // reduce_emi mode
  let balance = input.principal
  let currentRate = input.annualRate
  let remainingTenure = input.tenureMonths
  let emi = calculateEmi(input.principal, input.annualRate, input.tenureMonths)
  const schedule: AmortizationRow[] = []
  let totalInterest = 0
  const horizonEnd = addMonths(input.startDate, input.tenureMonths + 600)
  const existingExpanded = expandPrepayments(input.prepayments ?? [], horizonEnd)

  for (let month = 1; month <= input.tenureMonths && balance > 0.5; month++) {
    const date = addMonths(input.startDate, month - 1)
    const rate = rateAtDate(input.annualRate, date, input.rateChanges ?? [])

    if (rate !== currentRate) {
      currentRate = rate
      remainingTenure = input.tenureMonths - month + 1
      emi = calculateEmi(balance, currentRate, remainingTenure)
    }

    const monthlyRate = currentRate / 12 / 100
    const interest = balance * monthlyRate
    let principalPaid = Math.min(emi - interest, balance)
    if (principalPaid < 0) principalPaid = 0

    const existingPrepay = prepaymentAtDate(date, existingExpanded)
    const plannedExtra = plannedExtraForMonth(input.frequency, input.extraAmount, month, startAfter)
    const prepay = Math.min(existingPrepay + plannedExtra, balance - principalPaid)

    balance = Math.max(0, balance - principalPaid - prepay)
    totalInterest += interest

    remainingTenure = input.tenureMonths - month
    if (remainingTenure > 0 && balance > 0 && prepay > 0) {
      emi = calculateEmi(balance, currentRate, remainingTenure)
    }

    schedule.push({
      month,
      date,
      emi: principalPaid + interest,
      principal: principalPaid,
      interest,
      balance,
      prepayment: prepay,
      rate: currentRate,
    })
  }

  const withPrepayment: LoanSummary = {
    emi: schedule[schedule.length - 1]?.emi ?? emi,
    totalInterest,
    totalPayment: input.principal + totalInterest,
    schedule,
  }

  return {
    baseline,
    withPrepayment,
    interestSaved: baseline.totalInterest - withPrepayment.totalInterest,
    monthsSaved: baseline.schedule.length - withPrepayment.schedule.length,
    newEmi: withPrepayment.emi,
  }
}

/** Outstanding principal as of a given date (defaults to today). */
export function outstandingBalance(
  input: LoanInput,
  asOf: string = new Date().toISOString().slice(0, 10),
): number {
  const summary = generateAmortization(input)
  if (summary.schedule.length === 0) return input.principal
  const past = summary.schedule.filter((r) => r.date <= asOf)
  if (past.length === 0) return input.principal
  return past[past.length - 1].balance
}

/** Prefer stored EMI when present; otherwise formula EMI. */
export function effectiveLoanEmi(loan: {
  loanAmount: number
  interestRate: number
  tenureMonths: number
  emi?: number
}): number {
  if (loan.emi != null && loan.emi > 0) return loan.emi
  return calculateEmi(loan.loanAmount, loan.interestRate, loan.tenureMonths)
}

/**
 * Prefer manual amountPaid when set; otherwise amortize with optional EMI override.
 */
export function effectiveLoanOutstanding(
  loan: {
    loanAmount: number
    interestRate: number
    tenureMonths: number
    startDate: string
    emi?: number
    amountPaid?: number
    rateChanges?: { date: string; interestRate: number }[]
    prepayments?: Array<{
      date: string
      amount: number
      frequency?: PrepaymentFrequency
      endDate?: string
    }>
  },
  asOf?: string,
): number {
  if (loan.amountPaid != null && Number.isFinite(loan.amountPaid)) {
    return Math.max(0, loan.loanAmount - loan.amountPaid)
  }
  return outstandingBalance(
    {
      principal: loan.loanAmount,
      annualRate: loan.interestRate,
      tenureMonths: loan.tenureMonths,
      startDate: loan.startDate,
      emiOverride: loan.emi,
      rateChanges: loan.rateChanges,
      prepayments: loan.prepayments,
    },
    asOf,
  )
}

/** Schedule-estimated principal paid so far (ignores manual amountPaid). */
export function estimatedAmountPaid(
  loan: {
    loanAmount: number
    interestRate: number
    tenureMonths: number
    startDate: string
    emi?: number
    rateChanges?: { date: string; interestRate: number }[]
    prepayments?: Array<{
      date: string
      amount: number
      frequency?: PrepaymentFrequency
      endDate?: string
    }>
  },
  asOf?: string,
): number {
  const remaining = outstandingBalance(
    {
      principal: loan.loanAmount,
      annualRate: loan.interestRate,
      tenureMonths: loan.tenureMonths,
      startDate: loan.startDate,
      emiOverride: loan.emi,
      rateChanges: loan.rateChanges,
      prepayments: loan.prepayments,
    },
    asOf,
  )
  return Math.max(0, Math.min(loan.loanAmount, loan.loanAmount - remaining))
}
