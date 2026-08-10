import { describe, expect, it } from 'vitest'
import { parseDelimitedText } from './spreadsheet'
import { parseInvestmentsWorkbook } from './investments'
import { analyzeTradebook, mergeTrades } from '@/lib/finance/tradebook'
import type { WorkbookData } from './spreadsheet'
import type { Trade } from '@/types/finance'

const FY17_18 = `symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time
V2RETAIL,INE945H01013,2018-01-25,NSE,EQ,EQ,buy,false,10.000000,440.000000,75621180,1300000001731133,2018-01-25T10:24:32
SBIN,INE062A01020,2018-01-25,NSE,EQ,EQ,sell,false,100.000000,321.100006,75627904,1300000001807334,2018-01-25T10:25:39
SBIN,INE062A01020,2018-01-25,NSE,EQ,EQ,buy,false,100.000000,320.000000,75665996,1300000001851810,2018-01-25T10:31:20
URJA GLOBAL,INE550C01020,2018-01-31,BSE,EQ,T,buy,false,1500.000000,9.950000,1126200,1517369400001261043,2018-01-31T09:54:46
URJA GLOBAL,INE550C01020,2018-01-31,BSE,EQ,T,buy,false,380.000000,9.950000,1354900,1517369400001261583,2018-01-31T10:06:58
`

const FY18_19 = `symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time
V2RETAIL,INE945H01013,2018-05-29,NSE,EQ,EQ,sell,false,10.000000,443.000000,75805512,1300000001945978,2018-05-29T10:48:15
BAJAJ-AUTO,INE917I01010,2018-05-29,NSE,EQ,EQ,buy,false,10.000000,2828.000000,899679,1000000002260562,2018-05-29T11:04:15
BAJAJ-AUTO,INE917I01010,2018-05-29,NSE,EQ,EQ,sell,false,10.000000,2815.000000,1002085,1000000002295077,2018-05-29T11:22:09
`

function parseCsv(text: string, name: string) {
  const matrix = parseDelimitedText(text, ',')
  const wb: WorkbookData = { sheetNames: ['Sheet1'], sheets: { Sheet1: matrix } }
  return { matrix, parsed: parseInvestmentsWorkbook(wb, name) }
}

describe('YP1093 sample tradebooks', () => {
  it('reads every CSV row including spaced symbols like URJA GLOBAL', () => {
    const a = parseCsv(FY17_18, 'tradebook-YP1093-EQ17-18.csv')
    const b = parseCsv(FY18_19, 'tradebook-YP1093-EQ-18-19.csv')

    expect(a.matrix.length - 1).toBe(a.parsed.trades.length)
    expect(b.matrix.length - 1).toBe(b.parsed.trades.length)
    expect(a.parsed.trades.some((t) => t.symbol === 'URJA GLOBAL')).toBe(true)
    expect(b.parsed.trades.some((t) => t.symbol === 'BAJAJ-AUTO')).toBe(true)

    const merged = mergeTrades(a.parsed.trades, b.parsed.trades)
    const analysis = analyzeTradebook(merged.trades)
    const v2 = analysis.bySymbol.find((s) => s.symbol === 'V2RETAIL')
    expect(v2?.openQty ?? 0).toBe(0)
    expect(analysis.warnings.filter((w) => w.includes('unmatched'))).toHaveLength(0)
  })

  it('links empty-ISIN sells to earlier buys via symbol map + detects 2:1 split', () => {
    const trades: Trade[] = [
      {
        id: '1',
        tradeId: '1',
        symbol: 'ASHOKLEY',
        isin: 'INE208A01029',
        tradeType: 'buy',
        quantity: 10,
        price: 236.09,
        tradeDate: '2025-05-30',
        orderExecutionTime: '2025-05-30T14:59:45',
      },
      {
        id: '2',
        tradeId: '2',
        symbol: 'ASHOKLEY',
        isin: 'INE208A01029',
        tradeType: 'buy',
        quantity: 10,
        price: 236.83,
        tradeDate: '2025-06-02',
        orderExecutionTime: '2025-06-02T09:45:03',
      },
      {
        id: '3',
        tradeId: '3',
        symbol: 'ASHOKLEY',
        // empty ISIN as in BSE rows
        tradeType: 'sell',
        quantity: 40,
        price: 129.95,
        tradeDate: '2025-08-19',
        orderExecutionTime: '2025-08-19T09:52:10',
      },
    ]
    const result = analyzeTradebook(trades)
    expect(result.warnings.filter((w) => w.includes('unmatched'))).toHaveLength(0)
    expect(result.openLots).toHaveLength(0)
    expect(result.warnings.some((w) => w.includes('split'))).toBe(true)
  })

  it('treats IPO sell-only symbols as IPO credits', () => {
    const trades: Trade[] = [
      {
        id: '1',
        tradeId: '1',
        symbol: 'SYRMA',
        isin: 'INE0DYJ01015',
        tradeType: 'sell',
        quantity: 30,
        price: 287.3,
        tradeDate: '2022-08-26',
      },
    ]
    const result = analyzeTradebook(trades)
    expect(result.warnings.filter((w) => w.includes('unmatched'))).toHaveLength(0)
    expect(result.closedTrades[0].buyPrice).toBe(0)
    expect(result.closedTrades[0].flag).toBe('ipo')
    expect(result.warnings.some((w) => w.includes('IPO'))).toBe(true)
    expect(result.realizedPnl).toBeCloseTo(30 * 287.3, 0)
  })
})
