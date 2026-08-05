import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

function toDateString(d: Date | null | undefined): string {
  if (!d) return ''
  return d.toISOString().slice(0, 10)
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
        homeLoans: { include: { rateChanges: true, prepayments: true } },
        otherDebts: true,
        healthInsurance: true,
        expenses: true,
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
      salary: { monthlyInHand: user.salary?.monthlyInHand ?? 0 },
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
      mutualFunds: user.mutualFunds,
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
        rateChanges: l.rateChanges.map((r) => ({
          id: r.id,
          date: toDateString(r.date),
          interestRate: r.interestRate,
        })),
        prepayments: l.prepayments.map((p) => ({
          id: p.id,
          date: toDateString(p.date),
          amount: p.amount,
        })),
      })),
      otherDebts: user.otherDebts,
      healthInsurance: user.healthInsurance.map((h) => ({
        id: h.id,
        provider: h.provider,
        coverAmount: h.coverAmount,
        premium: h.premium,
        frequency: h.frequency,
        renewalDate: toDateString(h.renewalDate),
      })),
      expenses: user.expenses,
      settings: { theme: (user.settings?.theme ?? 'system') as 'light' | 'dark' | 'system' },
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
        create: { userId, monthlyInHand: data.salary?.monthlyInHand ?? 0 },
        update: { monthlyInHand: data.salary?.monthlyInHand ?? 0 },
      })

      await tx.userSettings.upsert({
        where: { userId },
        create: { userId, theme: data.settings?.theme ?? 'system' },
        update: { theme: data.settings?.theme ?? 'system' },
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
            }) => ({
              id: m.id,
              userId,
              name: m.name,
              investedAmount: m.investedAmount,
              currentValue: m.currentValue,
              monthlySip: m.monthlySip,
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
            rateChanges: {
              create: (l.rateChanges ?? []).map((r: { id?: string; date: string; interestRate: number }) => ({
                id: r.id,
                date: new Date(r.date),
                interestRate: r.interestRate,
              })),
            },
            prepayments: {
              create: (l.prepayments ?? []).map((p: { id?: string; date: string; amount: number }) => ({
                id: p.id,
                date: new Date(p.date),
                amount: p.amount,
              })),
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
              coverAmount: number
              premium: number
              frequency: string
              renewalDate: string
            }) => ({
              id: h.id,
              userId,
              provider: h.provider,
              coverAmount: h.coverAmount,
              premium: h.premium,
              frequency: h.frequency,
              renewalDate: new Date(h.renewalDate),
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
    })

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
