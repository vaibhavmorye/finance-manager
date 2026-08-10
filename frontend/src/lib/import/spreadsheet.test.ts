import { describe, expect, it } from 'vitest'
import {
  cellDate,
  cellStr,
  formatLocalDate,
  normalizeDateString,
  readSpreadsheetFile,
} from './spreadsheet'

describe('normalizeDateString', () => {
  it('keeps ISO dates', () => {
    expect(normalizeDateString('2024-01-15')).toBe('2024-01-15')
    expect(normalizeDateString('2024-01-15T10:30:00')).toBe('2024-01-15')
  })

  it('parses Indian DD/MM/YYYY and DD-MM-YYYY', () => {
    expect(normalizeDateString('15/01/2024')).toBe('2024-01-15')
    expect(normalizeDateString('15-01-2024')).toBe('2024-01-15')
    expect(normalizeDateString('01/04/2024')).toBe('2024-04-01') // prefer D/M/Y
    expect(normalizeDateString('13/02/2024')).toBe('2024-02-13')
  })

  it('detects US M/D/Y when day part is > 12 in second position', () => {
    expect(normalizeDateString('02/13/2024')).toBe('2024-02-13')
  })
})

describe('cellDate / cellStr dates', () => {
  it('formats Date with local calendar (no UTC shift)', () => {
    const d = new Date(2024, 5, 15) // Jun 15 local
    expect(formatLocalDate(d)).toBe('2024-06-15')
    expect(cellStr(d)).toBe('2024-06-15')
    expect(cellDate(d)).toBe('2024-06-15')
  })

  it('converts Excel serial dates', () => {
    expect(cellDate(45458)).toBe('2024-06-15')
  })
})

describe('readSpreadsheetFile', () => {
  it('reads all CSV rows and keeps Indian dates as text', async () => {
    const csv = [
      'symbol,trade_type,quantity,price,trade_date',
      'INFY,buy,10,100,15-01-2024',
      'TCS,sell,5,200,01/04/2024',
      'RELIANCE,buy,1,2500,2024-06-15',
    ].join('\n')
    const file = new File([csv], 'tradebook.csv', { type: 'text/csv' })
    const wb = await readSpreadsheetFile(file)
    const rows = wb.sheets[wb.sheetNames[0]]
    expect(rows).toHaveLength(4)
    expect(cellDate(rows[1][4])).toBe('2024-01-15')
    expect(cellDate(rows[2][4])).toBe('2024-04-01')
    expect(cellDate(rows[3][4])).toBe('2024-06-15')
  })

  it('reads xlsx matrices fully', async () => {
    const XLSX = await import('xlsx')
    const aoa = [
      ['symbol', 'trade_type', 'quantity', 'price', 'trade_date'],
      ['INFY', 'buy', 10, 100, '2024-01-15'],
      ['TCS', 'sell', 5, 200, '2024-04-01'],
    ]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    const wbOut = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wbOut, ws, 'tradebook')
    const buf = XLSX.write(wbOut, { type: 'array', bookType: 'xlsx' })
    const file = new File([buf], 'tradebook.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const wb = await readSpreadsheetFile(file)
    expect(wb.sheets.tradebook).toHaveLength(3)
    expect(cellStr(wb.sheets.tradebook[1][0])).toBe('INFY')
  })
})
