import { describe, expect, it } from 'vitest'
import { analyzeMfTradebook, mergeMfTransactions } from './mf-tradebook'
import { createId, type MfTransaction } from '@/types/finance'

function tx(
  partial: Omit<MfTransaction, 'id'> & { id?: string },
): MfTransaction {
  return { id: partial.id ?? createId(), ...partial }
}

describe('analyzeMfTradebook', () => {
  it('matches FIFO sell against earlier buys', () => {
    const fundId = 'fund-1'
    const analysis = analyzeMfTradebook([
      tx({ fundId, date: '2024-01-01', type: 'buy', units: 100, nav: 10 }),
      tx({ fundId, date: '2024-06-01', type: 'sip', units: 50, nav: 12 }),
      tx({ fundId, date: '2025-02-01', type: 'sell', units: 120, nav: 15 }),
    ])
    expect(analysis.closed).toHaveLength(2)
    expect(analysis.closed[0].units).toBe(100)
    expect(analysis.closed[0].pnl).toBe(500) // (15-10)*100
    expect(analysis.closed[1].units).toBe(20)
    expect(analysis.closed[1].buyNav).toBe(12)
    expect(analysis.openLots).toHaveLength(1)
    expect(analysis.openLots[0].units).toBe(30)
  })

  it('attributes sell to Indian FY of sell date', () => {
    const fundId = 'fund-1'
    const analysis = analyzeMfTradebook([
      tx({ fundId, date: '2023-04-01', type: 'buy', units: 10, nav: 100 }),
      tx({ fundId, date: '2025-03-15', type: 'sell', units: 10, nav: 120 }),
    ])
    expect(analysis.closed[0].sellYear).toBe(2024) // FY 2024-25
    expect(analysis.closed[0].holdingDays).toBeGreaterThan(365)
  })
})

describe('mergeMfTransactions', () => {
  it('dedupes by tradeId', () => {
    const existing = [
      tx({ fundId: 'f', tradeId: 'A1', date: '2024-01-01', type: 'buy', units: 1, nav: 10 }),
    ]
    const { added, skipped, transactions } = mergeMfTransactions(existing, [
      tx({ fundId: 'f', tradeId: 'A1', date: '2024-01-01', type: 'buy', units: 1, nav: 10 }),
      tx({ fundId: 'f', tradeId: 'B2', date: '2024-02-01', type: 'sip', units: 2, nav: 11 }),
    ])
    expect(added).toBe(1)
    expect(skipped).toBe(1)
    expect(transactions).toHaveLength(2)
  })
})
