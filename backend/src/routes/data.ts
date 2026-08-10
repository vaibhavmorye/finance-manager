import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

function toDateString(d: Date | null | undefined): string {
  if (!d) return ''
  return d.toISOString().slice(0, 10)
}

function currentFyStartYear(): number {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  return m >= 4 ? y : y - 1
}

function normalizeTaxProfile(raw: unknown) {
  const t = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  return {
    fyStartYear: typeof t.fyStartYear === 'number' ? t.fyStartYear : currentFyStartYear(),
    section80C: num(t.section80C),
    section80D: num(t.section80D),
    section80CCD1B: num(t.section80CCD1B),
    basicSalaryAnnual: num(t.basicSalaryAnnual),
    hraReceivedAnnual: num(t.hraReceivedAnnual),
    rentPaidAnnual: num(t.rentPaidAnnual),
    isMetro: typeof t.isMetro === 'boolean' ? t.isMetro : true,
    section24b: num(t.section24b),
  }
}

/** Returns the full finance snapshot for the authenticated user (frontend FinanceData shape). */
router.get('/snapshot', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        salary: true,
        otherIncomes: true,
        stocks: true,
        fixedDeposits: true,
        mutualFunds: true,
        mfTransactions: true,
        otherAssets: true,
        savingPots: true,
        homeLoans: { include: { rateChanges: true, prepayments: true } },
        otherDebts: true,
        healthInsurance: true,
        expenses: true,
        expenseEntries: true,
        settings: true,
      },
    })
    if (!user) return res.status(404).json({ error: 'User not found' })

    res.json({
      version: 1 as const,
      profile: {
        name: user.profile?.name ?? '',
        age: user.profile?.age ?? 30,
        currency: (user.profile?.currency ?? 'INR') as 'INR' | 'USD' | 'EUR' | 'GBP',
        retirementAge: user.profile?.retirementAge ?? 60,
        onboardingComplete: user.profile?.onboardingComplete ?? false,
      },
      salary: {
        monthlyGross: user.salary?.monthlyGross ?? 0,
        monthlyInHand: user.salary?.monthlyInHand ?? 0,
      },
      otherIncomes: user.otherIncomes,
      stocks: user.stocks.map((s) => ({
        id: s.id,
        name: s.name,
        ticker: s.ticker ?? undefined,
        quantity: s.quantity,
        buyPrice: s.buyPrice,
        currentPrice: s.currentPrice,
      })),
      fixedDeposits: user.fixedDeposits.map((f) => ({
        id: f.id,
        name: f.name,
        principal: f.principal,
        interestRate: f.interestRate,
        startDate: toDateString(f.startDate),
        maturityDate: toDateString(f.maturityDate),
      })),
      mutualFunds: user.mutualFunds.map((m) => ({
        id: m.id,
        name: m.name,
        investedAmount: m.investedAmount,
        currentValue: m.currentValue,
        monthlySip: m.monthlySip,
        fundCategory: (m.fundCategory === 'debt' ? 'debt' : 'equity') as 'equity' | 'debt',
      })),
      mfTransactions: (user.mfTransactions ?? []).map((t) => ({
        id: t.id,
        fundId: t.fundId,
        tradeId: t.tradeId ?? undefined,
        date: toDateString(t.date),
        type: t.type as 'buy' | 'sell' | 'sip',
        units: t.units,
        nav: t.nav,
        amount: t.amount ?? undefined,
        sourceFile: t.sourceFile ?? undefined,
      })),
      otherAssets: (user.otherAssets ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        kind: a.kind as 'gold' | 'silver' | 'other',
        quantity: a.quantity,
        unit: a.unit,
        buyPrice: a.buyPrice,
        currentPrice: a.currentPrice,
      })),
      savingPots: (user.savingPots ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        purpose: p.purpose as 'emergency' | 'education' | 'retirement' | 'custom',
        vehicle: p.vehicle as 'fd' | 'mf',
        targetAmount: p.targetAmount,
        targetDate: p.targetDate ? toDateString(p.targetDate) : undefined,
        currentAmount: p.currentAmount,
        monthlyAmount: p.monthlyAmount,
        expectedReturnPercent: p.expectedReturnPercent,
        planMode: (p.planMode === 'withdraw' ? 'withdraw' : 'accumulate') as
          | 'accumulate'
          | 'withdraw',
        swpYears: p.swpYears ?? undefined,
        swpCorpus: p.swpCorpus ?? undefined,
        linkedFixedDepositId: p.linkedFixedDepositId ?? undefined,
        linkedMutualFundId: p.linkedMutualFundId ?? undefined,
      })),
      homeLoans: user.homeLoans.map((l) => ({
        id: l.id,
        name: l.name,
        marketValue: l.marketValue,
        purchasePrice: l.purchasePrice,
        downPayment: l.downPayment,
        loanAmount: l.loanAmount,
        startDate: toDateString(l.startDate),
        interestRate: l.interestRate,
        tenureMonths: l.tenureMonths,
        emi: l.emi ?? undefined,
        amountPaid: l.amountPaid ?? undefined,
        rateChanges: l.rateChanges.map((r) => ({
          id: r.id,
          date: toDateString(r.date),
          interestRate: r.interestRate,
        })),
        prepayments: l.prepayments.map((p) => ({
          id: p.id,
          date: toDateString(p.date),
          amount: p.amount,
          frequency: p.frequency ?? undefined,
          endDate: p.endDate ? toDateString(p.endDate) : undefined,
        })),
      })),
      otherDebts: user.otherDebts,
      healthInsurance: user.healthInsurance.map((h) => ({
        id: h.id,
        provider: h.provider,
        type: h.type ?? 'health',
        coverAmount: h.coverAmount,
        premium: h.premium,
        frequency: h.frequency,
        renewalDate: toDateString(h.renewalDate),
        peopleCovered: Array.isArray(h.peopleCovered) ? h.peopleCovered : [],
      })),
      expenses: user.expenses,
      expenseEntries: user.expenseEntries.map((e) => ({
        id: e.id,
        category: e.category,
        name: e.name,
        amount: e.amount,
        date: toDateString(e.date),
        notes: e.notes ?? undefined,
      })),
      settings: { theme: (user.settings?.theme ?? 'system') as 'light' | 'dark' | 'system' },
      taxProfile: normalizeTaxProfile(user.settings?.taxProfile),
    })
  } catch (err) {
    next(err)
  }
})

/** Replace the entire snapshot (used by onboarding / import sync). */
router.put('/snapshot', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!
    const data = req.body

    await prisma.$transaction(async (tx) => {
      await tx.profile.upsert({
        where: { userId },
        create: {
          userId,
          name: data.profile?.name ?? '',
          age: data.profile?.age ?? 30,
          currency: data.profile?.currency ?? 'INR',
          retirementAge: data.profile?.retirementAge ?? 60,
          onboardingComplete: data.profile?.onboardingComplete ?? false,
        },
        update: {
          name: data.profile?.name ?? '',
          age: data.profile?.age ?? 30,
          currency: data.profile?.currency ?? 'INR',
          retirementAge: data.profile?.retirementAge ?? 60,
          onboardingComplete: data.profile?.onboardingComplete ?? false,
        },
      })

      await tx.salary.upsert({
        where: { userId },
        create: {
          userId,
          monthlyGross: data.salary?.monthlyGross ?? 0,
          monthlyInHand: data.salary?.monthlyInHand ?? 0,
        },
        update: {
          monthlyGross: data.salary?.monthlyGross ?? 0,
          monthlyInHand: data.salary?.monthlyInHand ?? 0,
        },
      })

      await tx.userSettings.upsert({
        where: { userId },
        create: {
          userId,
          theme: data.settings?.theme ?? 'system',
          taxProfile: data.taxProfile ?? normalizeTaxProfile(null),
        },
        update: {
          theme: data.settings?.theme ?? 'system',
          taxProfile: data.taxProfile ?? normalizeTaxProfile(null),
        },
      })

      await tx.otherIncome.deleteMany({ where: { userId } })
      if (data.otherIncomes?.length) {
        await tx.otherIncome.createMany({
          data: data.otherIncomes.map((i: { id?: string; name: string; amount: number; frequency: string }) => ({
            id: i.id,
            userId,
            name: i.name,
            amount: i.amount,
            frequency: i.frequency,
          })),
        })
      }

      await tx.stock.deleteMany({ where: { userId } })
      if (data.stocks?.length) {
        await tx.stock.createMany({
          data: data.stocks.map(
            (s: {
              id?: string
              name: string
              ticker?: string
              quantity: number
              buyPrice: number
              currentPrice: number
            }) => ({
              id: s.id,
              userId,
              name: s.name,
              ticker: s.ticker,
              quantity: s.quantity,
              buyPrice: s.buyPrice,
              currentPrice: s.currentPrice,
            }),
          ),
        })
      }

      await tx.fixedDeposit.deleteMany({ where: { userId } })
      if (data.fixedDeposits?.length) {
        await tx.fixedDeposit.createMany({
          data: data.fixedDeposits.map(
            (f: {
              id?: string
              name: string
              principal: number
              interestRate: number
              startDate: string
              maturityDate: string
            }) => ({
              id: f.id,
              userId,
              name: f.name,
              principal: f.principal,
              interestRate: f.interestRate,
              startDate: new Date(f.startDate),
              maturityDate: new Date(f.maturityDate),
            }),
          ),
        })
      }

      await tx.mfTransaction.deleteMany({ where: { userId } })
      await tx.mutualFund.deleteMany({ where: { userId } })
      if (data.mutualFunds?.length) {
        await tx.mutualFund.createMany({
          data: data.mutualFunds.map(
            (m: {
              id?: string
              name: string
              investedAmount: number
              currentValue: number
              monthlySip: number
              fundCategory?: string
            }) => ({
              id: m.id,
              userId,
              name: m.name,
              investedAmount: m.investedAmount,
              currentValue: m.currentValue,
              monthlySip: m.monthlySip,
              fundCategory: m.fundCategory === 'debt' ? 'debt' : 'equity',
            }),
          ),
        })
      }
      if (data.mfTransactions?.length) {
        await tx.mfTransaction.createMany({
          data: data.mfTransactions.map(
            (t: {
              id?: string
              fundId: string
              tradeId?: string
              date: string
              type: string
              units: number
              nav: number
              amount?: number
              sourceFile?: string
            }) => ({
              id: t.id,
              userId,
              fundId: t.fundId,
              tradeId: t.tradeId ?? null,
              date: new Date(t.date),
              type: t.type,
              units: t.units,
              nav: t.nav,
              amount: t.amount ?? null,
              sourceFile: t.sourceFile ?? null,
            }),
          ),
        })
      }

      await tx.otherAsset.deleteMany({ where: { userId } })
      if (data.otherAssets?.length) {
        await tx.otherAsset.createMany({
          data: data.otherAssets.map(
            (a: {
              id?: string
              name: string
              kind?: string
              quantity: number
              unit?: string
              buyPrice: number
              currentPrice: number
            }) => ({
              id: a.id,
              userId,
              name: a.name,
              kind: a.kind ?? 'other',
              quantity: a.quantity,
              unit: a.unit ?? 'g',
              buyPrice: a.buyPrice,
              currentPrice: a.currentPrice,
            }),
          ),
        })
      }

      await tx.savingPot.deleteMany({ where: { userId } })
      if (data.savingPots?.length) {
        await tx.savingPot.createMany({
          data: data.savingPots.map(
            (p: {
              id?: string
              name: string
              purpose: string
              vehicle: string
              targetAmount: number
              targetDate?: string
              currentAmount?: number
              monthlyAmount?: number
              expectedReturnPercent?: number
              planMode?: string
              swpYears?: number
              swpCorpus?: number
              linkedFixedDepositId?: string
              linkedMutualFundId?: string
            }) => ({
              id: p.id,
              userId,
              name: p.name,
              purpose: p.purpose,
              vehicle: p.vehicle,
              targetAmount: p.targetAmount,
              targetDate: p.targetDate ? new Date(p.targetDate) : null,
              currentAmount: p.currentAmount ?? 0,
              monthlyAmount: p.monthlyAmount ?? 0,
              expectedReturnPercent: p.expectedReturnPercent ?? 0,
              planMode: p.planMode === 'withdraw' ? 'withdraw' : 'accumulate',
              swpYears: p.swpYears ?? null,
              swpCorpus: p.swpCorpus ?? null,
              linkedFixedDepositId: p.linkedFixedDepositId ?? null,
              linkedMutualFundId: p.linkedMutualFundId ?? null,
            }),
          ),
        })
      }

      await tx.homeLoan.deleteMany({ where: { userId } })
      for (const l of data.homeLoans ?? []) {
        await tx.homeLoan.create({
          data: {
            id: l.id,
            userId,
            name: l.name,
            marketValue: l.marketValue,
            purchasePrice: l.purchasePrice,
            downPayment: l.downPayment,
            loanAmount: l.loanAmount,
            startDate: new Date(l.startDate),
            interestRate: l.interestRate,
            tenureMonths: l.tenureMonths,
            emi: l.emi ?? null,
            amountPaid: l.amountPaid ?? null,
            rateChanges: {
              create: (l.rateChanges ?? []).map((r: { id?: string; date: string; interestRate: number }) => ({
                id: r.id,
                date: new Date(r.date),
                interestRate: r.interestRate,
              })),
            },
            prepayments: {
              create: (
                l.prepayments ?? []
              ).map(
                (p: {
                  id?: string
                  date: string
                  amount: number
                  frequency?: string
                  endDate?: string
                }) => ({
                  id: p.id,
                  date: new Date(p.date),
                  amount: p.amount,
                  frequency: p.frequency ?? null,
                  endDate: p.endDate ? new Date(p.endDate) : null,
                }),
              ),
            },
          },
        })
      }

      await tx.otherDebt.deleteMany({ where: { userId } })
      if (data.otherDebts?.length) {
        await tx.otherDebt.createMany({
          data: data.otherDebts.map(
            (d: {
              id?: string
              name: string
              principal: number
              interestRate: number
              emi: number
              remainingMonths: number
            }) => ({
              id: d.id,
              userId,
              name: d.name,
              principal: d.principal,
              interestRate: d.interestRate,
              emi: d.emi,
              remainingMonths: d.remainingMonths,
            }),
          ),
        })
      }

      await tx.healthInsurance.deleteMany({ where: { userId } })
      if (data.healthInsurance?.length) {
        await tx.healthInsurance.createMany({
          data: data.healthInsurance.map(
            (h: {
              id?: string
              provider: string
              type?: string
              coverAmount: number
              premium: number
              frequency: string
              renewalDate: string
              peopleCovered?: string[]
            }) => ({
              id: h.id,
              userId,
              provider: h.provider,
              type: h.type ?? 'health',
              coverAmount: h.coverAmount,
              premium: h.premium,
              frequency: h.frequency,
              renewalDate: new Date(h.renewalDate),
              peopleCovered: h.peopleCovered ?? [],
            }),
          ),
        })
      }

      await tx.monthlyExpense.deleteMany({ where: { userId } })
      if (data.expenses?.length) {
        await tx.monthlyExpense.createMany({
          data: data.expenses.map(
            (e: { id?: string; category: string; name: string; amount: number }) => ({
              id: e.id,
              userId,
              category: e.category,
              name: e.name,
              amount: e.amount,
            }),
          ),
        })
      }

      await tx.expenseEntry.deleteMany({ where: { userId } })
      if (data.expenseEntries?.length) {
        await tx.expenseEntry.createMany({
          data: data.expenseEntries.map(
            (e: {
              id?: string
              category: string
              name: string
              amount: number
              date: string
              notes?: string
            }) => ({
              id: e.id,
              userId,
              category: e.category,
              name: e.name,
              amount: e.amount,
              date: new Date(e.date),
              notes: e.notes ?? null,
            }),
          ),
        })
      }
    })

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
