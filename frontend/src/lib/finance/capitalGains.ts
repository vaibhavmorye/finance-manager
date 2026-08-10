import type { FinanceData, FundCategory, MutualFund, Trade } from '@/types/finance'
import { analyzeTradebook, type ClosedTradeRow } from '@/lib/finance/tradebook'
import { analyzeMfTradebook, type MfClosedRow } from '@/lib/finance/mf-tradebook'

export type GainBucket = 'stcg' | 'ltcg' | 'debt_slab'

export const EQUITY_HOLDING_DAYS = 365
export const LTCG_EXEMPTION = 1_25_000
export const EQUITY_STCG_RATE = 0.2
export const EQUITY_LTCG_RATE = 0.125

export interface ClassifiedGain {
  source: 'stock' | 'mf'
  fundCategory?: FundCategory
  symbolOrFundId: string
  pnl: number
  holdingDays: number
  sellYear: number
  bucket: GainBucket
}

export interface CapitalGainsFySummary {
  fyStartYear: number
  /** Listed equity / equity MF short-term gains (special rate). */
  equityStcg: number
  /** Listed equity / equity MF long-term gains before exemption. */
  equityLtcg: number
  /** Portion of equity LTCG covered by §112A exemption. */
  ltcgExemptionUsed: number
  /** Taxable equity LTCG after exemption. */
  equityLtcgTaxable: number
  /** Debt / non-equity MF gains → taxed at slab rates. */
  debtSlabGains: number
  stockStcg: number
  stockLtcg: number
  mfEquityStcg: number
  mfEquityLtcg: number
  mfDebtGains: number
  rows: ClassifiedGain[]
}

export function classifyEquityHolding(holdingDays: number): 'stcg' | 'ltcg' {
  return holdingDays < EQUITY_HOLDING_DAYS ? 'stcg' : 'ltcg'
}

function fundCategoryOf(fund: MutualFund | undefined): FundCategory {
  return fund?.fundCategory === 'debt' ? 'debt' : 'equity'
}

export function classifyStockClosed(row: ClosedTradeRow): ClassifiedGain {
  const kind = classifyEquityHolding(row.holdingDays)
  return {
    source: 'stock',
    symbolOrFundId: row.symbol,
    pnl: row.pnl,
    holdingDays: row.holdingDays,
    sellYear: row.sellYear,
    bucket: kind,
  }
}

export function classifyMfClosed(
  row: MfClosedRow,
  category: FundCategory,
): ClassifiedGain {
  if (category === 'debt') {
    return {
      source: 'mf',
      fundCategory: 'debt',
      symbolOrFundId: row.fundId,
      pnl: row.pnl,
      holdingDays: row.holdingDays,
      sellYear: row.sellYear,
      bucket: 'debt_slab',
    }
  }
  const kind = classifyEquityHolding(row.holdingDays)
  return {
    source: 'mf',
    fundCategory: 'equity',
    symbolOrFundId: row.fundId,
    pnl: row.pnl,
    holdingDays: row.holdingDays,
    sellYear: row.sellYear,
    bucket: kind,
  }
}

export function summarizeCapitalGainsForFy(
  rows: ClassifiedGain[],
  fyStartYear: number,
): CapitalGainsFySummary {
  const fyRows = rows.filter((r) => r.sellYear === fyStartYear)
  let stockStcg = 0
  let stockLtcg = 0
  let mfEquityStcg = 0
  let mfEquityLtcg = 0
  let mfDebtGains = 0

  for (const r of fyRows) {
    if (r.bucket === 'debt_slab') {
      mfDebtGains += r.pnl
      continue
    }
    if (r.source === 'stock') {
      if (r.bucket === 'stcg') stockStcg += r.pnl
      else stockLtcg += r.pnl
    } else {
      if (r.bucket === 'stcg') mfEquityStcg += r.pnl
      else mfEquityLtcg += r.pnl
    }
  }

  // Losses net within each equity bucket; negative STCG/LTCG reduce tax.
  const equityStcg = stockStcg + mfEquityStcg
  const equityLtcg = stockLtcg + mfEquityLtcg
  const ltcgPositive = Math.max(0, equityLtcg)
  const ltcgExemptionUsed = Math.min(LTCG_EXEMPTION, ltcgPositive)
  const equityLtcgTaxable = Math.max(0, ltcgPositive - ltcgExemptionUsed)

  return {
    fyStartYear,
    equityStcg,
    equityLtcg,
    ltcgExemptionUsed,
    equityLtcgTaxable,
    debtSlabGains: mfDebtGains,
    stockStcg,
    stockLtcg,
    mfEquityStcg,
    mfEquityLtcg,
    mfDebtGains,
    rows: fyRows,
  }
}

export function capitalGainsTaxFromSummary(summary: CapitalGainsFySummary): {
  stcgTax: number
  ltcgTax: number
  totalSpecialRateTax: number
} {
  const stcgTaxable = Math.max(0, summary.equityStcg)
  const stcgTax = Math.round(stcgTaxable * EQUITY_STCG_RATE * 100) / 100
  const ltcgTax = Math.round(summary.equityLtcgTaxable * EQUITY_LTCG_RATE * 100) / 100
  return {
    stcgTax,
    ltcgTax,
    totalSpecialRateTax: Math.round((stcgTax + ltcgTax) * 100) / 100,
  }
}

export function collectCapitalGains(data: FinanceData): ClassifiedGain[] {
  const stockClosed = analyzeTradebook(data.trades ?? [] as Trade[]).closedTrades
  const fundById = new Map(data.mutualFunds.map((f) => [f.id, f]))
  const mfClosed = analyzeMfTradebook(data.mfTransactions ?? []).closed

  const rows: ClassifiedGain[] = [
    ...stockClosed.map(classifyStockClosed),
    ...mfClosed.map((r) => classifyMfClosed(r, fundCategoryOf(fundById.get(r.fundId)))),
  ]
  return rows
}

export function capitalGainsForFy(
  data: FinanceData,
  fyStartYear: number,
): CapitalGainsFySummary {
  return summarizeCapitalGainsForFy(collectCapitalGains(data), fyStartYear)
}
