import { describe, expect, it } from 'vitest'
import {
  aggregateClosedTradesBySymbol,
  aggregateOpenLotsBySymbol,
  analyzeTradebook,
  financialYearStart,
  formatFinancialYear,
  mergeTrades,
} from './tradebook'
import type { Trade } from '@/types/finance'

function t(partial: Partial<Trade> & Pick<Trade, 'tradeId' | 'symbol' | 'tradeType' | 'quantity' | 'price' | 'tradeDate'>): Trade {
  return {
    id: partial.id ?? crypto.randomUUID(),
    orderId: partial.orderId,
    isin: partial.isin,
    exchange: partial.exchange,
    segment: partial.segment ?? 'EQ',
    ...partial,
  }
}

describe('Indian financial year', () => {
  it('maps Apr–Mar correctly', () => {
    expect(financialYearStart('2017-04-01')).toBe(2017)
    expect(financialYearStart('2018-03-31')).toBe(2017)
    expect(financialYearStart('2018-04-01')).toBe(2018)
    expect(financialYearStart('2017-12-15')).toBe(2017)
    expect(financialYearStart('2018-01-10')).toBe(2017)
    expect(formatFinancialYear(2017)).toBe('FY 2017-18')
    expect(formatFinancialYear(2018)).toBe('FY 2018-19')
  })
})

describe('analyzeTradebook', () => {
  it('computes realized and unrealized PnL with FIFO', () => {
    const trades = [
      t({ tradeId: '1', symbol: 'INFY', tradeType: 'buy', quantity: 10, price: 100, tradeDate: '2025-01-01' }),
      t({ tradeId: '2', symbol: 'INFY', tradeType: 'buy', quantity: 10, price: 200, tradeDate: '2025-02-01' }),
      t({ tradeId: '3', symbol: 'INFY', tradeType: 'sell', quantity: 5, price: 250, tradeDate: '2025-03-01' }),
    ]
    const result = analyzeTradebook(trades)
    // Sold 5 from first lot @100 → realized (250-100)*5 = 750
    expect(result.realizedPnl).toBe(750)
    // Remaining 5@100 + 10@200 = 15, cost 2500
    expect(result.positions[0].quantity).toBe(15)
    expect(result.totalInvested).toBe(2500)
    // Mark = last trade price 250 → market 15*250 = 3750
    expect(result.marketValue).toBe(3750)
    expect(result.unrealizedPnl).toBe(1250)
    // Totals must match sum of open lots
    expect(result.openLots.reduce((s, l) => s + l.invested, 0)).toBe(result.totalInvested)
    expect(result.openLots.reduce((s, l) => s + l.marketValue, 0)).toBe(result.marketValue)

    // Sell in Mar 2025 → FY 2024-25 (start 2024)
    expect(result.closedTrades).toHaveLength(1)
    expect(result.closedTrades[0]).toMatchObject({
      symbol: 'INFY',
      quantity: 5,
      buyDate: '2025-01-01',
      sellDate: '2025-03-01',
      sellYear: 2024,
      buyPrice: 100,
      sellPrice: 250,
      pnl: 750,
    })
    expect(result.bySellYear).toHaveLength(1)
    expect(result.bySellYear[0].year).toBe(2024)
    expect(result.bySellYear[0].label).toBe('FY 2024-25')
    expect(result.bySellYear[0].realizedPnl).toBe(750)
    expect(result.openLots).toHaveLength(2)
    expect(result.openLots[0].buyDate).toBe('2025-01-01')
    expect(result.openLots[0].quantity).toBe(5)

    const agg = aggregateOpenLotsBySymbol(result.openLots)
    expect(agg).toHaveLength(1)
    expect(agg[0]).toMatchObject({
      symbol: 'INFY',
      lotCount: 2,
      quantity: 15,
      invested: 2500,
      marketValue: 3750,
      unrealizedPnl: 1250,
    })
    expect(agg[0].avgBuyPrice).toBeCloseTo(2500 / 15, 2)
    expect(agg[0].lots).toHaveLength(2)
  })

  it('attributes closed trades to the FY of the sell, not the buy', () => {
    const trades = [
      t({ tradeId: '1', symbol: 'TCS', tradeType: 'buy', quantity: 10, price: 1000, tradeDate: '2017-06-15' }),
      t({ tradeId: '2', symbol: 'TCS', tradeType: 'sell', quantity: 10, price: 1200, tradeDate: '2018-05-10' }),
    ]
    const result = analyzeTradebook(trades)
    // Buy FY 2017-18, sell FY 2018-19 → shown under 2018-19
    expect(result.closedTrades[0].sellYear).toBe(2018)
    expect(result.bySellYear).toHaveLength(1)
    expect(result.bySellYear[0].year).toBe(2018)
    expect(result.bySellYear[0].label).toBe('FY 2018-19')
    expect(result.bySellYear[0].realizedPnl).toBe(2000)
    expect(result.openLots).toHaveLength(0)
    expect(result.totalInvested).toBe(0)
  })

  it('keeps same-FY buy and sell in that FY', () => {
    const trades = [
      t({ tradeId: '1', symbol: 'INFY', tradeType: 'buy', quantity: 5, price: 100, tradeDate: '2017-05-01' }),
      t({ tradeId: '2', symbol: 'INFY', tradeType: 'sell', quantity: 5, price: 110, tradeDate: '2018-02-01' }),
    ]
    const result = analyzeTradebook(trades)
    expect(result.closedTrades[0].sellYear).toBe(2017)
    expect(result.bySellYear[0].label).toBe('FY 2017-18')
  })

  it('covers sell-before-buy (intraday short) using quantity, not buy-first only', () => {
    // Mirrors user's SBIN / BATA / BAJFINANCE pattern
    const trades = [
      t({
        tradeId: 's1',
        symbol: 'SBIN',
        tradeType: 'sell',
        quantity: 100,
        price: 321.1,
        tradeDate: '2018-01-25',
        orderExecutionTime: '2018-01-25T10:25:39',
      }),
      t({
        tradeId: 'b1',
        symbol: 'SBIN',
        tradeType: 'buy',
        quantity: 100,
        price: 320,
        tradeDate: '2018-01-25',
        orderExecutionTime: '2018-01-25T10:31:20',
      }),
      t({
        tradeId: 's2',
        symbol: 'BATAINDIA',
        tradeType: 'sell',
        quantity: 15,
        price: 713,
        tradeDate: '2018-01-29',
        orderExecutionTime: '2018-01-29T09:35:33',
      }),
      t({
        tradeId: 's3',
        symbol: 'BATAINDIA',
        tradeType: 'sell',
        quantity: 50,
        price: 713,
        tradeDate: '2018-01-29',
        orderExecutionTime: '2018-01-29T09:35:38',
      }),
      t({
        tradeId: 's4',
        symbol: 'BATAINDIA',
        tradeType: 'sell',
        quantity: 35,
        price: 713,
        tradeDate: '2018-01-29',
        orderExecutionTime: '2018-01-29T09:35:47',
      }),
      t({
        tradeId: 'b2',
        symbol: 'BATAINDIA',
        tradeType: 'buy',
        quantity: 100,
        price: 711,
        tradeDate: '2018-01-29',
        orderExecutionTime: '2018-01-29T09:50:54',
      }),
      t({
        tradeId: 's5',
        symbol: 'BAJFINANCE',
        tradeType: 'sell',
        quantity: 20,
        price: 1716.2,
        tradeDate: '2018-01-29',
        orderExecutionTime: '2018-01-29T13:05:29',
      }),
      t({
        tradeId: 'b3',
        symbol: 'BAJFINANCE',
        tradeType: 'buy',
        quantity: 20,
        price: 1715,
        tradeDate: '2018-01-29',
        orderExecutionTime: '2018-01-29T14:46:07',
      }),
    ]
    const result = analyzeTradebook(trades)
    expect(result.warnings).toEqual([])
    expect(result.openLots).toHaveLength(0)
    // SBIN: (321.1-320)*100 = 110
    // BATA: (713-711)*100 = 200
    // BAJFINANCE: (1716.2-1715)*20 = 24
    expect(result.realizedPnl).toBeCloseTo(110 + 200 + 24, 1)
    expect(result.closedTrades.some((c) => c.symbol === 'SBIN' && c.quantity === 100)).toBe(true)
    expect(result.closedTrades.filter((c) => c.symbol === 'BATAINDIA').reduce((s, c) => s + c.quantity, 0)).toBe(100)
  })

  it('merges spaced / truncated tickers via ISIN into one lot queue', () => {
    const trades = [
      t({
        tradeId: '1',
        symbol: 'URJA GLOBAL',
        isin: 'INE550C01020',
        tradeType: 'buy',
        quantity: 1500,
        price: 10,
        tradeDate: '2018-01-31',
      }),
      t({
        tradeId: '2',
        symbol: 'URJAGLOBA',
        isin: 'INE550C01020',
        tradeType: 'sell',
        quantity: 1500,
        price: 12,
        tradeDate: '2018-02-01',
      }),
    ]
    const result = analyzeTradebook(trades)
    expect(result.warnings.filter((w) => w.includes('unmatched'))).toHaveLength(0)
    expect(result.openLots).toHaveLength(0)
    expect(result.realizedPnl).toBe(3000)
  })

  it('aggregates multiple buy/sell fills of the same symbol', () => {
    const trades = [
      t({ tradeId: '1', symbol: 'SBIN', tradeType: 'buy', quantity: 100, price: 320, tradeDate: '2018-01-25' }),
      t({ tradeId: '2', symbol: 'SBIN', tradeType: 'buy', quantity: 50, price: 310, tradeDate: '2018-01-26' }),
      t({ tradeId: '3', symbol: 'SBIN', tradeType: 'sell', quantity: 80, price: 330, tradeDate: '2018-01-27' }),
      t({ tradeId: '4', symbol: 'SBIN', tradeType: 'sell', quantity: 70, price: 340, tradeDate: '2018-01-28' }),
    ]
    const result = analyzeTradebook(trades)
    // 150 bought, 150 sold → fully closed; FIFO creates multiple slices
    expect(result.closedTrades.length).toBeGreaterThan(1)
    const agg = aggregateClosedTradesBySymbol(result.closedTrades)
    expect(agg).toHaveLength(1)
    expect(agg[0].symbol).toBe('SBIN')
    expect(agg[0].quantity).toBe(150)
    expect(agg[0].fillCount).toBe(result.closedTrades.length)
    expect(agg[0].buyValue).toBe(100 * 320 + 50 * 310)
    expect(agg[0].avgBuyPrice).toBeCloseTo((100 * 320 + 50 * 310) / 150, 2)
  })

  it('treats rights entitlement sells without buys as cost-0 corp credits', () => {
    const trades = [
      t({
        tradeId: '1',
        symbol: 'URJA-RE',
        isin: 'INE550C01020',
        tradeType: 'sell',
        quantity: 100,
        price: 2,
        tradeDate: '2018-03-01',
      }),
    ]
    const result = analyzeTradebook(trades)
    expect(result.warnings.some((w) => w.includes('unmatched'))).toBe(false)
    expect(result.closedTrades).toHaveLength(1)
    expect(result.closedTrades[0].buyPrice).toBe(0)
    expect(result.closedTrades[0].flag).toBe('rights')
    expect(result.realizedPnl).toBe(200)
  })

  it('merges truncated spellings without ISIN when nearly identical', () => {
    const trades = [
      t({ tradeId: '1', symbol: 'URJAGLOBAL', tradeType: 'buy', quantity: 10, price: 10, tradeDate: '2018-01-01' }),
      t({ tradeId: '2', symbol: 'URJAGLOBA', tradeType: 'sell', quantity: 10, price: 11, tradeDate: '2018-01-02' }),
    ]
    const result = analyzeTradebook(trades)
    expect(result.warnings.filter((w) => w.includes('unmatched'))).toHaveLength(0)
    expect(result.realizedPnl).toBe(10)
  })

  it('tags user buyback exitType onto closed fills and preserves it on re-import', () => {
    const trades = [
      t({ tradeId: '1', symbol: 'TCS', tradeType: 'buy', quantity: 10, price: 3000, tradeDate: '2024-01-01' }),
      t({
        tradeId: '2',
        symbol: 'TCS',
        tradeType: 'sell',
        quantity: 10,
        price: 3500,
        tradeDate: '2024-06-01',
        exitType: 'buyback',
      }),
    ]
    const result = analyzeTradebook(trades)
    expect(result.closedTrades[0].flag).toBe('buyback')
    expect(result.closedTrades[0].sellTradeId).toBe('2')
    const agg = aggregateClosedTradesBySymbol(result.closedTrades)
    expect(agg[0].flag).toBe('buyback')
    expect(agg[0].sellTradeIds).toEqual(['2'])

    const reimport = [
      t({ tradeId: '2', symbol: 'TCS', tradeType: 'sell', quantity: 10, price: 3500, tradeDate: '2024-06-01' }),
    ]
    const merged = mergeTrades(trades, reimport)
    expect(merged.skipped).toBe(1)
    expect(merged.trades.find((x) => x.tradeId === '2')?.exitType).toBe('buyback')
  })
})
