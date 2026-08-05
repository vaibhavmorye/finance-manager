export interface SipInput {
  monthlyAmount: number
  annualReturnPercent: number
  years: number
  stepUpPercent?: number
}

export interface SipYearPoint {
  year: number
  invested: number
  value: number
  gains: number
}

export interface SipResult {
  futureValue: number
  totalInvested: number
  totalGains: number
  projection: SipYearPoint[]
}

export function calculateSip(input: SipInput): SipResult {
  const { monthlyAmount, annualReturnPercent, years, stepUpPercent = 0 } = input
  const monthlyRate = annualReturnPercent / 12 / 100

  let value = 0
  let invested = 0
  let currentSip = monthlyAmount
  const projection: SipYearPoint[] = [{ year: 0, invested: 0, value: 0, gains: 0 }]

  for (let year = 1; year <= years; year++) {
    for (let m = 0; m < 12; m++) {
      value = (value + currentSip) * (1 + monthlyRate)
      invested += currentSip
    }
    projection.push({
      year,
      invested,
      value,
      gains: value - invested,
    })
    currentSip *= 1 + stepUpPercent / 100
  }

  return {
    futureValue: value,
    totalInvested: invested,
    totalGains: value - invested,
    projection,
  }
}

/** Future value of a lump sum with monthly compounding */
export function futureValueLumpSum(
  principal: number,
  annualReturnPercent: number,
  years: number,
): number {
  const monthlyRate = annualReturnPercent / 12 / 100
  return principal * Math.pow(1 + monthlyRate, years * 12)
}
