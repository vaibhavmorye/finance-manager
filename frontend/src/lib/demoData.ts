import {
  createDefaultTaxProfile,
  createId,
  currentFyStartYear,
  type FinanceData,
} from '@/types/finance'

/** ISO date helper relative to today (local calendar). */
function isoDate(offsetDays = 0, from = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offsetDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function ymDay(year: number, monthIndex0: number, day: number): string {
  const m = String(monthIndex0 + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${year}-${m}-${d}`
}

/**
 * Sample household for “Checkout demo”: urban Indian mid-career professional
 * (Bengaluru, ~₹18 LPA CTC) with typical investments, home loan, and FIRE goal at 55.
 */
export function createDemoData(now = new Date()): FinanceData {
  const fy = currentFyStartYear(now)
  const y = now.getFullYear()
  const m = now.getMonth()

  const mfFlexi = createId()
  const mfIndex = createId()
  const mfDebt = createId()
  const fdEmergency = createId()
  const fdShort = createId()
  const potEmergency = createId()
  const potEducation = createId()
  const potRetirement = createId()

  const trade = (
    symbol: string,
    tradeType: 'buy' | 'sell',
    tradeDate: string,
    quantity: number,
    price: number,
    suffix: string,
  ) => ({
    id: createId(),
    tradeId: `DEMO-${symbol}-${suffix}`,
    symbol,
    tradeDate,
    exchange: 'NSE',
    segment: 'EQ',
    series: 'EQ',
    tradeType,
    quantity,
    price,
    sourceFile: 'demo-tradebook.csv',
  })

  return {
    version: 1,
    profile: {
      name: 'Aarav Mehta (Demo)',
      age: 33,
      currency: 'INR',
      retirementAge: 55,
      onboardingComplete: true,
    },
    // ~₹18 LPA CTC → monthly gross; in-hand after PF / tax / NPS
    salary: {
      monthlyGross: 150_000,
      monthlyInHand: 112_000,
    },
    otherIncomes: [
      {
        id: createId(),
        name: 'Spouse — part-time tutoring',
        amount: 12_000,
        frequency: 'monthly',
      },
      {
        id: createId(),
        name: 'Equity dividends',
        amount: 8_500,
        frequency: 'yearly',
      },
    ],
    stocks: [
      {
        id: createId(),
        name: 'Reliance Industries',
        ticker: 'RELIANCE',
        quantity: 25,
        buyPrice: 2_450,
        currentPrice: 2_820,
        source: 'tradebook',
      },
      {
        id: createId(),
        name: 'Tata Consultancy Services',
        ticker: 'TCS',
        quantity: 12,
        buyPrice: 3_520,
        currentPrice: 3_880,
        source: 'tradebook',
      },
      {
        id: createId(),
        name: 'Infosys',
        ticker: 'INFY',
        quantity: 40,
        buyPrice: 1_380,
        currentPrice: 1_690,
        source: 'tradebook',
      },
      {
        id: createId(),
        name: 'HDFC Bank',
        ticker: 'HDFCBANK',
        quantity: 30,
        buyPrice: 1_520,
        currentPrice: 1_740,
        source: 'tradebook',
      },
    ],
    trades: [
      trade('RELIANCE', 'buy', ymDay(y - 2, 5, 12), 25, 2_450, 'B1'),
      trade('TCS', 'buy', ymDay(y - 2, 8, 3), 12, 3_520, 'B1'),
      trade('INFY', 'buy', ymDay(y - 1, 2, 18), 60, 1_380, 'B1'),
      trade('INFY', 'sell', ymDay(y - 1, 10, 7), 20, 1_620, 'S1'),
      trade('HDFCBANK', 'buy', ymDay(y - 1, 6, 22), 30, 1_520, 'B1'),
    ],
    fixedDeposits: [
      {
        id: fdEmergency,
        name: 'SBI Digi FD — emergency',
        principal: 400_000,
        interestRate: 6.8,
        startDate: ymDay(y - 1, 3, 1),
        maturityDate: ymDay(y + 1, 3, 1),
      },
      {
        id: fdShort,
        name: 'HDFC Bank FD — short term',
        principal: 250_000,
        interestRate: 7.1,
        startDate: ymDay(y, Math.max(0, m - 4), 15),
        maturityDate: ymDay(y + 1, Math.max(0, m - 4), 15),
      },
    ],
    mutualFunds: [
      {
        id: mfFlexi,
        name: 'Parag Parikh Flexi Cap',
        investedAmount: 450_000,
        currentValue: 612_000,
        monthlySip: 15_000,
        fundCategory: 'equity',
      },
      {
        id: mfIndex,
        name: 'UTI Nifty 50 Index',
        investedAmount: 300_000,
        currentValue: 378_000,
        monthlySip: 10_000,
        fundCategory: 'equity',
      },
      {
        id: mfDebt,
        name: 'HDFC Corporate Bond',
        investedAmount: 200_000,
        currentValue: 214_000,
        monthlySip: 5_000,
        fundCategory: 'debt',
      },
    ],
    mfTransactions: [
      {
        id: createId(),
        fundId: mfFlexi,
        tradeId: 'DEMO-MF-FLEXI-1',
        date: ymDay(y - 2, 4, 5),
        type: 'buy',
        units: 1_200,
        nav: 62.5,
        amount: 75_000,
        sourceFile: 'demo-mf.csv',
      },
      {
        id: createId(),
        fundId: mfFlexi,
        tradeId: 'DEMO-MF-FLEXI-SIP',
        date: isoDate(-12, now),
        type: 'sip',
        units: 185.2,
        nav: 81.0,
        amount: 15_000,
        sourceFile: 'demo-mf.csv',
      },
      {
        id: createId(),
        fundId: mfIndex,
        tradeId: 'DEMO-MF-NIFTY-1',
        date: ymDay(y - 1, 7, 10),
        type: 'buy',
        units: 1_050,
        nav: 142.8,
        amount: 150_000,
        sourceFile: 'demo-mf.csv',
      },
      {
        id: createId(),
        fundId: mfDebt,
        tradeId: 'DEMO-MF-DEBT-1',
        date: ymDay(y - 1, 1, 20),
        type: 'buy',
        units: 6_800,
        nav: 29.4,
        amount: 200_000,
        sourceFile: 'demo-mf.csv',
      },
    ],
    otherAssets: [
      {
        id: createId(),
        name: '22K jewellery (wedding)',
        kind: 'gold',
        quantity: 40,
        unit: 'g',
        buyPrice: 5_800,
        currentPrice: 7_250,
      },
      {
        id: createId(),
        name: 'Silver coins',
        kind: 'silver',
        quantity: 250,
        unit: 'g',
        buyPrice: 72,
        currentPrice: 95,
      },
    ],
    savingPots: [
      {
        id: potEmergency,
        name: 'Emergency fund',
        purpose: 'emergency',
        vehicle: 'fd',
        targetAmount: 600_000,
        targetDate: ymDay(y + 1, 3, 1),
        currentAmount: 400_000,
        monthlyAmount: 0,
        expectedReturnPercent: 6.8,
        planMode: 'accumulate',
        linkedFixedDepositId: fdEmergency,
      },
      {
        id: potEducation,
        name: 'Kids education',
        purpose: 'education',
        vehicle: 'mf',
        targetAmount: 25_00_000,
        targetDate: ymDay(y + 12, 5, 1),
        currentAmount: 378_000,
        monthlyAmount: 10_000,
        expectedReturnPercent: 12,
        planMode: 'accumulate',
        linkedMutualFundId: mfIndex,
      },
      {
        id: potRetirement,
        name: 'Retirement corpus',
        purpose: 'retirement',
        vehicle: 'mf',
        targetAmount: 2_00_00_000,
        targetDate: ymDay(y + 22, 0, 1),
        currentAmount: 612_000,
        monthlyAmount: 15_000,
        expectedReturnPercent: 12,
        planMode: 'accumulate',
        linkedMutualFundId: mfFlexi,
      },
    ],
    homeLoans: [
      {
        id: createId(),
        name: '2BHK — Whitefield, Bengaluru',
        marketValue: 11_000_000,
        purchasePrice: 8_500_000,
        downPayment: 2_000_000,
        loanAmount: 6_500_000,
        startDate: ymDay(y - 4, 2, 1),
        interestRate: 8.4,
        tenureMonths: 240,
        emi: 56_200,
        amountPaid: 1_150_000,
        rateChanges: [
          {
            id: createId(),
            date: ymDay(y - 1, 9, 1),
            interestRate: 8.4,
          },
        ],
        prepayments: [
          {
            id: createId(),
            date: ymDay(y - 1, 0, 5),
            amount: 100_000,
            frequency: 'one_time',
          },
          {
            id: createId(),
            date: ymDay(y, 0, 5),
            amount: 5_000,
            frequency: 'monthly',
            endDate: ymDay(y, 11, 5),
          },
        ],
      },
    ],
    otherDebts: [
      {
        id: createId(),
        name: 'Car loan — Hyundai Creta',
        principal: 320_000,
        interestRate: 9.2,
        emi: 12_400,
        remainingMonths: 28,
      },
    ],
    healthInsurance: [
      {
        id: createId(),
        provider: 'Star Health Family Floater',
        type: 'health',
        coverAmount: 1_000_000,
        premium: 22_500,
        frequency: 'yearly',
        renewalDate: ymDay(y, 10, 15),
        peopleCovered: ['self', 'spouse', 'children'],
      },
      {
        id: createId(),
        provider: 'HDFC Life Click 2 Protect',
        type: 'term',
        coverAmount: 10_000_000,
        premium: 18_200,
        frequency: 'yearly',
        renewalDate: ymDay(y + 1, 1, 1),
        peopleCovered: ['self'],
      },
    ],
    expenses: [
      { id: createId(), category: 'groceries', name: 'Groceries & household', amount: 12_000 },
      { id: createId(), category: 'utilities', name: 'Electricity, water, internet', amount: 4_800 },
      { id: createId(), category: 'transport', name: 'Fuel + metro / cab', amount: 6_000 },
      { id: createId(), category: 'dining', name: 'Dining out & food delivery', amount: 5_000 },
      { id: createId(), category: 'entertainment', name: 'OTT, outings', amount: 3_000 },
      { id: createId(), category: 'subscriptions', name: 'Cloud, apps, gym', amount: 1_800 },
      { id: createId(), category: 'education', name: 'Child activities / courses', amount: 4_000 },
      { id: createId(), category: 'healthcare', name: 'Medicines & checkups', amount: 2_500 },
      { id: createId(), category: 'other', name: 'Misc & personal care', amount: 3_500 },
    ],
    expenseEntries: [
      {
        id: createId(),
        category: 'groceries',
        name: 'BigBasket weekly',
        amount: 3_200,
        date: isoDate(-2, now),
      },
      {
        id: createId(),
        category: 'dining',
        name: 'Weekend dinner',
        amount: 1_850,
        date: isoDate(-3, now),
      },
      {
        id: createId(),
        category: 'transport',
        name: 'Petrol fill',
        amount: 2_400,
        date: isoDate(-5, now),
      },
      {
        id: createId(),
        category: 'utilities',
        name: 'BESCOM + broadband',
        amount: 4_800,
        date: isoDate(-8, now),
        notes: 'Monthly utilities',
      },
      {
        id: createId(),
        category: 'entertainment',
        name: 'Movie + snacks',
        amount: 1_200,
        date: isoDate(-10, now),
      },
      {
        id: createId(),
        category: 'education',
        name: 'Swimming class fees',
        amount: 4_000,
        date: isoDate(-12, now),
      },
      {
        id: createId(),
        category: 'groceries',
        name: 'Kirana & vegetables',
        amount: 2_100,
        date: isoDate(-14, now),
      },
      {
        id: createId(),
        category: 'other',
        name: 'Haircut & personal care',
        amount: 900,
        date: isoDate(-16, now),
      },
    ],
    taxProfile: {
      ...createDefaultTaxProfile(fy),
      // Typical salaried claims near limits
      section80C: 150_000,
      section80D: 25_000,
      section80CCD1B: 50_000,
      // ~40% of CTC as basic; HRA common in metro CTC breakup
      basicSalaryAnnual: 720_000,
      hraReceivedAnnual: 360_000,
      rentPaidAnnual: 0,
      isMetro: true,
      section24b: 200_000,
    },
    settings: { theme: 'system' },
  }
}
