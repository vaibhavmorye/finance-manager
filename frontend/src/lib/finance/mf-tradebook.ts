import type { MfTransaction } from '@/types/finance'
import { createId } from '@/types/finance'
import { financialYearStart } from '@/lib/finance/tradebook'

export interface MfLot {
  units: number
  nav: number
  buyDate: string
}

/** One FIFO-matched closed MF slice (buy/SIP ↔ sell). */
export interface MfClosedRow {
  id: string
  fundId: string
  units: number
  buyDate: string
  sellDate: string
  /** Indian FY start year of the sell. */
  sellYear: number
  buyNav: number
  sellNav: number
  buyValue: number
  sellValue: number
  pnl: number
  holdingDays: number
}

export interface MfOpenLotRow {
  id: string
  fundId: string
  units: number
  buyDate: string
  buyNav: number
  invested: number
}

export interface MfFundSummary {
  fundId: string
  openUnits: number
  invested: number
  closedCount: number
  realizedPnl: number
}

export interface MfTradebookAnalysis {
  closed: MfClosedRow[]
  openLots: MfOpenLotRow[]
  byFund: MfFundSummary[]
  realizedPnl: number
}

function roundUnits(n: number): number {
  return Math.round(n * 1e6) / 1e6
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function dayDiff(buy: string, sell: string): number {
  const a = Date.parse(buy.slice(0, 10))
  const b = Date.parse(sell.slice(0, 10))
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.max(0, Math.round(Math.abs(b - a) / 86_400_000))
}

function txAmount(t: MfTransaction): number {
  if (t.amount != null && Number.isFinite(t.amount)) return t.amount
  return roundMoney(t.units * t.nav)
}

/**
 * Merge incoming MF transactions. Prefer `tradeId` for dedup when present;
 * otherwise keep all (manual entries may lack tradeId).
 */
export function mergeMfTransactions(
  existing: MfTransaction[],
  incoming: MfTransaction[],
): { transactions: MfTransaction[]; added: number; skipped: number } {
  const seen = new Set(
    existing.map((t) => t.tradeId).filter((id): id is string => Boolean(id)),
  )
  const out = [...existing]
  let added = 0
  let skipped = 0
  for (const t of incoming) {
    if (t.tradeId && seen.has(t.tradeId)) {
      skipped++
      continue
    }
    if (t.tradeId) seen.add(t.tradeId)
    out.push({ ...t, id: t.id || createId() })
    added++
  }
  return { transactions: out, added, skipped }
}

/** FIFO analysis of MF unit ledger, grouped by fundId. */
export function analyzeMfTradebook(transactions: MfTransaction[]): MfTradebookAnalysis {
  const byFund = new Map<string, MfTransaction[]>()
  for (const t of transactions) {
    if (!t.fundId || !Number.isFinite(t.units) || t.units <= 0) continue
    const list = byFund.get(t.fundId) ?? []
    list.push(t)
    byFund.set(t.fundId, list)
  }

  const closed: MfClosedRow[] = []
  const openLots: MfOpenLotRow[] = []
  const summaries: MfFundSummary[] = []

  for (const [fundId, txs] of byFund) {
    const sorted = [...txs].sort((a, b) => {
      const da = a.date.slice(0, 10)
      const db = b.date.slice(0, 10)
      if (da !== db) return da.localeCompare(db)
      // Buys/SIPs before sells on the same day
      const rank = (t: MfTransaction) => (t.type === 'sell' ? 1 : 0)
      return rank(a) - rank(b)
    })

    const lots: MfLot[] = []
    let realized = 0
    let closedCount = 0

    for (const t of sorted) {
      if (t.type === 'buy' || t.type === 'sip') {
        lots.push({ units: t.units, nav: t.nav, buyDate: t.date.slice(0, 10) })
        continue
      }
      if (t.type !== 'sell') continue

      let remaining = t.units
      const sellDate = t.date.slice(0, 10)
      const sellNav = t.nav

      while (remaining > 1e-9 && lots.length > 0) {
        const lot = lots[0]
        const take = Math.min(lot.units, remaining)
        const buyValue = roundMoney(take * lot.nav)
        const sellValue = roundMoney(take * sellNav)
        const pnl = roundMoney(sellValue - buyValue)
        closed.push({
          id: createId(),
          fundId,
          units: roundUnits(take),
          buyDate: lot.buyDate,
          sellDate,
          sellYear: financialYearStart(sellDate),
          buyNav: lot.nav,
          sellNav,
          buyValue,
          sellValue,
          pnl,
          holdingDays: dayDiff(lot.buyDate, sellDate),
        })
        realized += pnl
        closedCount++
        lot.units = roundUnits(lot.units - take)
        remaining = roundUnits(remaining - take)
        if (lot.units <= 1e-9) lots.shift()
      }
    }

    let openUnits = 0
    let invested = 0
    for (const lot of lots) {
      if (lot.units <= 1e-9) continue
      openUnits += lot.units
      invested += lot.units * lot.nav
      openLots.push({
        id: createId(),
        fundId,
        units: roundUnits(lot.units),
        buyDate: lot.buyDate,
        buyNav: lot.nav,
        invested: roundMoney(lot.units * lot.nav),
      })
    }

    summaries.push({
      fundId,
      openUnits: roundUnits(openUnits),
      invested: roundMoney(invested),
      closedCount,
      realizedPnl: roundMoney(realized),
    })
  }

  return {
    closed,
    openLots,
    byFund: summaries,
    realizedPnl: roundMoney(closed.reduce((s, c) => s + c.pnl, 0)),
  }
}

/** Invested amount from open lots for a fund (0 if no ledger). */
export function investedFromMfLots(
  transactions: MfTransaction[],
  fundId: string,
): number {
  const analysis = analyzeMfTradebook(transactions.filter((t) => t.fundId === fundId))
  return analysis.byFund.find((f) => f.fundId === fundId)?.invested ?? 0
}

export { txAmount }
