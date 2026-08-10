import { describe, expect, it } from 'vitest'
import { parseInvestmentsWorkbook } from './investments'
import type { WorkbookData } from './spreadsheet'

describe('parseInvestmentsWorkbook', () => {
  it('parses generic template rows', () => {
    const wb: WorkbookData = {
      sheetNames: ['Holdings'],
      sheets: {
        Holdings: [
          [
            'type',
            'name',
            'ticker',
            'quantity',
            'buyPrice',
            'currentPrice',
            'investedAmount',
            'currentValue',
            'monthlySip',
            'principal',
            'interestRate',
            'startDate',
            'maturityDate',
            'unit',
          ],
          ['stock', 'Reliance', 'RELIANCE', 10, 2500, 2800, '', '', '', '', '', '', '', ''],
          ['mf', 'Flexi Cap', '', '', '', '', 50000, 62000, 5000, '', '', '', '', ''],
          ['fd', 'HDFC FD', '', '', '', '', '', '', '', 100000, 7, '2024-01-01', '2025-01-01', ''],
          ['gold', 'Physical gold', '', 50, 6500, 7200, '', '', '', '', '', '', '', 'g'],
          ['silver', 'Physical silver', '', 500, 80, 95, '', '', '', '', '', '', '', 'g'],
        ],
      },
    }
    const result = parseInvestmentsWorkbook(wb)
    expect(result.stocks).toHaveLength(1)
    expect(result.stocks[0].ticker).toBe('RELIANCE')
    expect(result.stocks[0].quantity).toBe(10)
    expect(result.mutualFunds).toHaveLength(1)
    expect(result.mutualFunds[0].monthlySip).toBe(5000)
    expect(result.fixedDeposits).toHaveLength(1)
    expect(result.fixedDeposits[0].principal).toBe(100000)
    expect(result.otherAssets).toHaveLength(2)
    expect(result.otherAssets[0].kind).toBe('gold')
    expect(result.otherAssets[0].quantity).toBe(50)
    expect(result.otherAssets[0].unit).toBe('g')
    expect(result.otherAssets[1].kind).toBe('silver')
  })

  it('parses Zerodha-style holdings headers', () => {
    const wb: WorkbookData = {
      sheetNames: ['Holdings'],
      sheets: {
        Holdings: [
          ['Instrument', 'Qty.', 'Avg. cost', 'LTP', 'Cur. val', 'P&L'],
          ['INFY', 5, 1400, 1500, 7500, 500],
          ['TCS', 2, 3500, 3600, 7200, 200],
        ],
      },
    }
    const result = parseInvestmentsWorkbook(wb)
    expect(result.format).toBe('Zerodha holdings')
    expect(result.stocks).toHaveLength(2)
    expect(result.stocks[0].name).toBe('INFY')
    expect(result.stocks[0].currentPrice).toBe(1500)
  })

  it('parses Zerodha tradebook into open holdings via FIFO', () => {
    const wb: WorkbookData = {
      sheetNames: ['tradebook'],
      sheets: {
        tradebook: [
          [
            'symbol',
            'isin',
            'trade_date',
            'exchange',
            'segment',
            'series',
            'trade_type',
            'auction',
            'quantity',
            'price',
            'trade_id',
            'order_id',
            'order_execution_time',
          ],
          ['INFY', 'INE009A01021', '2025-01-01', 'NSE', 'EQ', 'EQ', 'buy', 'false', 10, 100, '1', '1', '2025-01-01T10:00:00'],
          ['INFY', 'INE009A01021', '2025-02-01', 'NSE', 'EQ', 'EQ', 'buy', 'false', 10, 200, '2', '2', '2025-02-01T10:00:00'],
          ['INFY', 'INE009A01021', '2025-03-01', 'NSE', 'EQ', 'EQ', 'sell', 'false', 5, 250, '3', '3', '2025-03-01T10:00:00'],
          ['TCS', 'INE467B01029', '2025-01-15', 'NSE', 'EQ', 'EQ', 'buy', 'false', 2, 3500, '4', '4', '2025-01-15T10:00:00'],
          ['TCS', 'INE467B01029', '2025-04-01', 'NSE', 'EQ', 'EQ', 'sell', 'false', 2, 3600, '5', '5', '2025-04-01T10:00:00'],
        ],
      },
    }
    const result = parseInvestmentsWorkbook(wb)
    expect(result.format).toBe('Tradebook')
    // TCS fully sold; INFY left with 15 (5 from first lot @100 + 10 from second @200)
    expect(result.stocks).toHaveLength(1)
    expect(result.stocks[0].ticker).toBe('INFY')
    expect(result.stocks[0].quantity).toBe(15)
    // FIFO: sold 5 from first lot → remaining 5@100 + 10@200 = 2500/15
    expect(result.stocks[0].buyPrice).toBeCloseTo(2500 / 15, 2)
    expect(result.stocks[0].currentPrice).toBe(250)
  })

  it('normalizes Indian trade dates and merges multiple tradebook sheets', () => {
    const wb: WorkbookData = {
      sheetNames: ['fy17', 'fy18'],
      sheets: {
        fy17: [
          ['symbol', 'trade_type', 'quantity', 'price', 'trade_date', 'segment', 'trade_id'],
          ['INFY', 'buy', 10, 100, '15-06-2017', 'EQ', 'a'],
        ],
        fy18: [
          ['symbol', 'trade_type', 'quantity', 'price', 'trade_date', 'segment', 'trade_id'],
          ['INFY', 'sell', 10, 150, '10/05/2018', 'EQ', 'b'],
        ],
      },
    }
    const result = parseInvestmentsWorkbook(wb)
    expect(result.trades).toHaveLength(2)
    expect(result.trades[0].tradeDate).toBe('2017-06-15')
    expect(result.trades[1].tradeDate).toBe('2018-05-10')
    expect(result.stocks).toHaveLength(0)
    expect(result.realizedPnl).toBe(500)
  })
})
