export interface FireInput {
  currentCorpus: number
  monthlySavings: number
  expectedReturnPercent: number
  inflationPercent: number
  withdrawalRatePercent: number
  currentAge: number
  annualExpenses: number
}

export interface FireProjectionPoint {
  year: number
  age: number
  corpus: number
  fireNumber: number
}

export interface FireResult {
  fireNumber: number
  yearsToFire: number | null
  fireAge: number | null
  coastFireAge: number | null
  coastFireCorpus: number
  projection: FireProjectionPoint[]
}

export function calculateFire(input: FireInput): FireResult {
  const {
    currentCorpus,
    monthlySavings,
    expectedReturnPercent,
    inflationPercent,
    withdrawalRatePercent,
    currentAge,
    annualExpenses,
  } = input

  const realReturn = (1 + expectedReturnPercent / 100) / (1 + inflationPercent / 100) - 1
  const monthlyRealReturn = Math.pow(1 + realReturn, 1 / 12) - 1
  const fireNumber = withdrawalRatePercent > 0 ? annualExpenses / (withdrawalRatePercent / 100) : 0

  // Coast FIRE: corpus that grows to fireNumber by retirement without further contributions
  // Using a default retirement horizon of age 60 for coast calc
  const yearsToRetirement = Math.max(0, 60 - currentAge)
  const coastFireCorpus =
    yearsToRetirement > 0 && realReturn > -1
      ? fireNumber / Math.pow(1 + realReturn, yearsToRetirement)
      : fireNumber

  let corpus = currentCorpus
  const projection: FireProjectionPoint[] = [
    { year: 0, age: currentAge, corpus, fireNumber },
  ]

  let yearsToFire: number | null = null
  let fireAge: number | null = null
  let coastFireAge: number | null = currentCorpus >= coastFireCorpus ? currentAge : null

  const maxYears = 50
  for (let year = 1; year <= maxYears; year++) {
    for (let m = 0; m < 12; m++) {
      corpus = corpus * (1 + monthlyRealReturn) + monthlySavings
    }

    const age = currentAge + year
    // Projection kept in today's money (real terms)
    projection.push({ year, age, corpus, fireNumber })

    if (coastFireAge === null && corpus >= coastFireCorpus) {
      coastFireAge = age
    }

    if (yearsToFire === null && corpus >= fireNumber) {
      yearsToFire = year
      fireAge = age
    }

    // Cap projection growth display when far past FIRE
    if (yearsToFire !== null && year > yearsToFire + 5) break
  }

  return {
    fireNumber,
    yearsToFire,
    fireAge,
    coastFireAge,
    coastFireCorpus,
    projection,
  }
}
