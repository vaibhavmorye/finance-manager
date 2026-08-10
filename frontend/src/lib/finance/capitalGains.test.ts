import { describe, expect, it } from 'vitest'
import {
  classifyEquityHolding,
  summarizeCapitalGainsForFy,
  capitalGainsTaxFromSummary,
  LTCG_EXEMPTION,
  type ClassifiedGain,
} from './capitalGains'

describe('classifyEquityHolding', () => {
  it('uses 365-day boundary', () => {
    expect(classifyEquityHolding(364)).toBe('stcg')
    expect(classifyEquityHolding(365)).toBe('ltcg')
  })
})

describe('summarizeCapitalGainsForFy', () => {
  it('shares LTCG exemption across stocks and equity MF', () => {
    const rows: ClassifiedGain[] = [
      {
        source: 'stock',
        symbolOrFundId: 'ABC',
        pnl: 1_00_000,
        holdingDays: 400,
        sellYear: 2025,
        bucket: 'ltcg',
      },
      {
        source: 'mf',
        fundCategory: 'equity',
        symbolOrFundId: 'fund',
        pnl: 80_000,
        holdingDays: 400,
        sellYear: 2025,
        bucket: 'ltcg',
      },
      {
        source: 'stock',
        symbolOrFundId: 'XYZ',
        pnl: 50_000,
        holdingDays: 30,
        sellYear: 2025,
        bucket: 'stcg',
      },
    ]
    const summary = summarizeCapitalGainsForFy(rows, 2025)
    expect(summary.equityLtcg).toBe(1_80_000)
    expect(summary.ltcgExemptionUsed).toBe(LTCG_EXEMPTION)
    expect(summary.equityLtcgTaxable).toBe(1_80_000 - LTCG_EXEMPTION)
    expect(summary.equityStcg).toBe(50_000)

    const tax = capitalGainsTaxFromSummary(summary)
    expect(tax.stcgTax).toBe(10_000) // 20% of 50k
    expect(tax.ltcgTax).toBeCloseTo((55_000) * 0.125, 0)
  })

  it('routes debt MF gains to slab bucket', () => {
    const rows: ClassifiedGain[] = [
      {
        source: 'mf',
        fundCategory: 'debt',
        symbolOrFundId: 'debt-fund',
        pnl: 40_000,
        holdingDays: 800,
        sellYear: 2025,
        bucket: 'debt_slab',
      },
    ]
    const summary = summarizeCapitalGainsForFy(rows, 2025)
    expect(summary.debtSlabGains).toBe(40_000)
    expect(summary.equityLtcg).toBe(0)
  })
})
