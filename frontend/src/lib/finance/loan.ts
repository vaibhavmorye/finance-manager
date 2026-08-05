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
  rateChanges?: { date: string; interestRate: number }[]
  prepayments?: { date: string; amount: number }[]
}

export type PrepaymentMode = 'reduce_tenure' | 'reduce_emi'
export type PrepaymentFrequency = 'monthly' | 'weekly' | 'lump_sum'

export interface PrepaymentPlanInput extends LoanInput {
  extraAmount: number
  frequency: 'monthly' | 'weekly'
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

/** Standard EMI formula */
export function calculateEmi(principal: number, annualRate: number, tenureMonths: number): number {
  if (principal <= 0 || tenureMonths <= 0) return 0
  if (annualRate === 0) return principal / tenureMonths
  const r = annualRate / 12 / 100
  const factor = Math.pow(1 + r, tenureMonths)
  return (principal * r * factor) / (factor - 1)
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
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
    rateChanges = [],
    prepayments = [],
  } = input

  let balance = principal
  let currentRate = annualRate
  let emi = calculateEmi(principal, annualRate, tenureMonths)
  const schedule: AmortizationRow[] = []
  let totalInterest = 0
  let month = 0

  while (balance > 0.5 && month < tenureMonths + 600) {
    month++
    const date = addMonths(startDate, month - 1)
    const rate = rateAtDate(annualRate, date, rateChanges)

    if (rate !== currentRate) {
      currentRate = rate
      const remaining = tenureMonths - month + 1
      if (remaining > 0) {
        emi = calculateEmi(balance, currentRate, remaining)
      }
    }

    const monthlyRate = currentRate / 12 / 100
    const interest = balance * monthlyRate
    let principalPaid = Math.min(emi - interest, balance)
    if (principalPaid < 0) principalPaid = 0

    let payment = principalPaid + interest
    const prepay = Math.min(prepaymentAtDate(date, prepayments), balance - principalPaid)
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
    emi: schedule[0]?.emi ?? emi,
    totalInterest,
    totalPayment: principal + totalInterest,
    schedule,
  }
}

export function calculatePrepaymentPlan(input: PrepaymentPlanInput): PrepaymentComparison {
  const baseline = generateAmortization(input)
  const startAfter = input.startAfterMonths ?? 0

  if (input.mode === 'reduce_tenure') {
    const syntheticPrepayments = [...(input.prepayments ?? [])]
    const weeksPerMonth = input.frequency === 'weekly' ? 4 : 1
    const monthlyExtra = input.extraAmount * weeksPerMonth

    for (let m = startAfter; m < input.tenureMonths + 600; m++) {
      const date = addMonths(input.startDate, m)
      syntheticPrepayments.push({ date, amount: monthlyExtra })
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

  // reduce_emi mode: recalculate EMI after applying extras conceptually by
  // keeping tenure fixed and lowering EMI proportionally via higher principal paydown
  const weeksPerMonth = input.frequency === 'weekly' ? 4 : 1
  const monthlyExtra = input.extraAmount * weeksPerMonth
  let balance = input.principal
  let currentRate = input.annualRate
  let remainingTenure = input.tenureMonths
  let emi = calculateEmi(input.principal, input.annualRate, input.tenureMonths)
  const schedule: AmortizationRow[] = []
  let totalInterest = 0

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

    const existingPrepay = prepaymentAtDate(date, input.prepayments ?? [])
    const plannedExtra = month > startAfter ? monthlyExtra : 0
    const prepay = Math.min(existingPrepay + plannedExtra, balance - principalPaid)

    balance = Math.max(0, balance - principalPaid - prepay)
    totalInterest += interest

    // Recalculate EMI after prepayment to reduce EMI, keep tenure
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
