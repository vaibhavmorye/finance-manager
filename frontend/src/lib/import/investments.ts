import type { Stock, MutualFund, FixedDeposit, Trade, OtherAsset, OtherAssetKind } from '@/types/finance'
import { createId, defaultUnitForKind } from '@/types/finance'
import {
  type WorkbookData,
  type SheetMatrix,
  cellStr,
  cellNum,
  cellDate,
  normalizeHeader,
} from './spreadsheet'
import { analyzeTradebook } from '@/lib/finance/tradebook'

export interface ImportResult {
  format: string
  stocks: Stock[]
  mutualFunds: MutualFund[]
  fixedDeposits: FixedDeposit[]
  otherAssets: OtherAsset[]
  trades: Trade[]
  warnings: string[]
  notes: string[]
  realizedPnl?: number
  unrealizedPnl?: number
}

type HeaderMap = Record<string, number>

function findHeaderRow(rows: SheetMatrix, requiredAny: string[]): { rowIndex: number; map: HeaderMap } | null {
  const limit = Math.min(rows.length, 80)
  for (let i = 0; i < limit; i++) {
    const row = rows[i]
    if (!row?.length) continue
    const map: HeaderMap = {}
    row.forEach((cell, idx) => {
      const h = normalizeHeader(cellStr(cell))
      if (h) map[h] = idx
    })
    const keys = Object.keys(map)
    const hit = requiredAny.some((r) => keys.some((k) => k.includes(r) || r.includes(k)))
    if (hit && keys.length >= 2) return { rowIndex: i, map }
  }
  return null
}

function col(map: HeaderMap, ...aliases: string[]): number | undefined {
  for (const [key, idx] of Object.entries(map)) {
    for (const a of aliases) {
      if (key === a || key.includes(a)) return idx
    }
  }
  return undefined
}

function isZerodhaTaxPnl(wb: WorkbookData): boolean {
  const names = wb.sheetNames.join(' | ').toLowerCase()
  return (
    names.includes('tradewise') ||
    (names.includes('open positions') && names.includes('equity and non equity')) ||
    names.includes('mutual funds') && names.includes('ledger balances')
  )
}

function isZerodhaHoldings(rows: SheetMatrix): boolean {
  const found = findHeaderRow(rows, ['instrument', 'qty', 'avg cost', 'ltp'])
  if (!found) return false
  const hasInstrument = col(found.map, 'instrument') != null
  const hasQty = col(found.map, 'qty', 'quantity') != null
  // Tradebook also has quantity/price — don't confuse with holdings
  if (col(found.map, 'trade type', 'trade_type') != null) return false
  return Boolean(hasInstrument && hasQty)
}

function isTradebook(rows: SheetMatrix): boolean {
  const found = findHeaderRow(rows, ['symbol', 'trade type', 'trade_type', 'quantity', 'price'])
  if (!found) return false
  const hasSymbol = col(found.map, 'symbol') != null
  const hasType = col(found.map, 'trade type', 'trade_type') != null
  const hasQty = col(found.map, 'quantity', 'qty') != null
  const hasPrice = col(found.map, 'price') != null
  return Boolean(hasSymbol && hasType && hasQty && hasPrice)
}

/** Build open equity positions from a Zerodha-style tradebook using FIFO. */
function parseTradebook(rows: SheetMatrix, sourceFile?: string): ImportResult {
  const found = findHeaderRow(rows, ['symbol', 'trade type', 'trade_type'])
  if (!found) {
    return emptyResult('Tradebook', ['Could not find tradebook header row'])
  }

  const { rowIndex, map } = found
  const iSym = col(map, 'symbol')!
  const iIsin = col(map, 'isin')
  const iDate = col(map, 'trade date', 'trade_date')
  const iExec = col(map, 'order execution time', 'order_execution_time')
  const iType = col(map, 'trade type', 'trade_type')!
  const iQty = col(map, 'quantity', 'qty')!
  const iPrice = col(map, 'price')!
  const iSegment = col(map, 'segment')
  const iExchange = col(map, 'exchange')
  const iSeries = col(map, 'series')
  const iTradeId = col(map, 'trade id', 'trade_id')
  const iOrderId = col(map, 'order id', 'order_id')
  const iAuction = col(map, 'auction')

  const trades: Trade[] = []
  let skippedFo = 0
  let skippedBad = 0
  let dataRows = 0

  for (let r = rowIndex + 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row) continue
    const symbol = cellStr(row[iSym])
    if (!symbol || normalizeHeader(symbol) === 'symbol') continue
    dataRows++

    const typeRaw = cellStr(row[iType]).toLowerCase()
    if (typeRaw !== 'buy' && typeRaw !== 'sell') {
      skippedBad++
      continue
    }
    const qty = cellNum(row[iQty])
    const price = cellNum(row[iPrice])
    if (qty <= 0 || price < 0) {
      skippedBad++
      continue
    }
    const segment = iSegment != null ? cellStr(row[iSegment]).toUpperCase() : 'EQ'
    if (['FO', 'FUT', 'OPT', 'CDS', 'COM', 'MCX'].includes(segment)) {
      skippedFo++
      continue
    }

    const tradeDate =
      iDate != null ? cellDate(row[iDate]) : ''
    const execRaw = iExec != null ? cellStr(row[iExec]) : ''
    const execDate = execRaw ? cellDate(execRaw) : ''
    const orderExecutionTime = execRaw
      ? execRaw.includes('T') || execRaw.includes(' ')
        ? execRaw
        : execDate || execRaw
      : undefined
    const tradeIdRaw = iTradeId != null ? cellStr(row[iTradeId]) : ''
    const orderId = iOrderId != null ? cellStr(row[iOrderId]) || undefined : undefined
    const tradeId =
      tradeIdRaw ||
      `${symbol}|${tradeDate}|${typeRaw}|${qty}|${price}|${orderId ?? r}`

    const auctionRaw = iAuction != null ? cellStr(row[iAuction]).toLowerCase() : ''
    trades.push({
      id: createId(),
      tradeId,
      orderId,
      symbol,
      isin: iIsin != null ? cellStr(row[iIsin]) || undefined : undefined,
      tradeDate: tradeDate || execDate || (orderExecutionTime?.slice(0, 10) ?? ''),
      exchange: iExchange != null ? cellStr(row[iExchange]) || undefined : undefined,
      segment,
      series: iSeries != null ? cellStr(row[iSeries]) || undefined : undefined,
      tradeType: typeRaw,
      auction: auctionRaw === 'true' || auctionRaw === '1' || auctionRaw === 'yes',
      quantity: qty,
      price,
      orderExecutionTime,
      sourceFile,
    })
  }

  const analysis = analyzeTradebook(trades)
  const warnings = [...analysis.warnings]
  if (skippedFo > 0) {
    warnings.push(`Skipped ${skippedFo} F&O / non-equity row(s) (segment FO/FUT/OPT/…).`)
  }
  if (skippedBad > 0) {
    warnings.push(`Skipped ${skippedBad} row(s) with missing buy/sell, qty, or price.`)
  }

  return {
    format: 'Tradebook',
    stocks: analysis.positions,
    mutualFunds: [],
    fixedDeposits: [],
    otherAssets: [],
    trades,
    realizedPnl: analysis.realizedPnl,
    unrealizedPnl: analysis.unrealizedPnl,
    warnings,
    notes: [
      `Read ${rows.length} sheet row(s) · ${dataRows} data row(s) → ${trades.length} equity trade(s)`,
      `${trades.length} trade(s) in file → ${analysis.positions.length} open holding(s)`,
      `Realized P&L ${analysis.realizedPnl >= 0 ? '+' : ''}${analysis.realizedPnl.toLocaleString()} · Unrealized ${analysis.unrealizedPnl >= 0 ? '+' : ''}${analysis.unrealizedPnl.toLocaleString()}`,
      'Import multiple tradebooks to build full history (duplicates are skipped by trade_id).',
    ],
  }
}

function parseZerodhaHoldings(rows: SheetMatrix): ImportResult {
  const found = findHeaderRow(rows, ['instrument', 'qty'])
  if (!found) {
    return emptyResult('Zerodha holdings', ['Could not find holdings header row'])
  }

  const { rowIndex, map } = found
  const iInst = col(map, 'instrument')!
  const iQty = col(map, 'qty', 'quantity')!
  const iAvg = col(map, 'avg cost', 'avg', 'average price', 'buy price')
  const iLtp = col(map, 'ltp', 'last traded', 'current price', 'price')
  const iCur = col(map, 'cur val', 'current value', 'cur val')

  const stocks: Stock[] = []
  for (let r = rowIndex + 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row) continue
    const name = cellStr(row[iInst])
    if (!name || normalizeHeader(name) === 'instrument') continue
    if (name.toLowerCase().includes('total')) continue
    const quantity = cellNum(row[iQty])
    if (quantity <= 0) continue
    const buyPrice = iAvg != null ? cellNum(row[iAvg]) : 0
    let currentPrice = iLtp != null ? cellNum(row[iLtp]) : 0
    if (!currentPrice && iCur != null && quantity) {
      currentPrice = cellNum(row[iCur]) / quantity
    }
    stocks.push({
      id: createId(),
      name,
      ticker: name.split(' ')[0] || name,
      quantity,
      buyPrice,
      currentPrice: currentPrice || buyPrice,
    })
  }

  return {
    format: 'Zerodha holdings',
    stocks,
    mutualFunds: [],
    fixedDeposits: [],
    otherAssets: [],
    trades: [],
    warnings: stocks.length === 0 ? ['No holdings rows found'] : [],
    notes: [`Imported ${stocks.length} stock holding(s)`],
  }
}

function parseGenericHoldings(rows: SheetMatrix): ImportResult | null {
  const found = findHeaderRow(rows, [
    'symbol',
    'ticker',
    'name',
    'quantity',
    'qty',
    'type',
    'stock',
    'mutual',
  ])
  if (!found) return null

  const { rowIndex, map } = found
  const iType = col(map, 'type', 'asset')
  const iName = col(map, 'name', 'instrument', 'scheme', 'fund')
  const iTicker = col(map, 'ticker', 'symbol', 'isin')
  const iQty = col(map, 'quantity', 'qty', 'units')
  const iBuy = col(map, 'buy price', 'avg cost', 'average price', 'purchase price')
  const iCurrent = col(map, 'current price', 'ltp', 'price', 'nav')
  const iInvested = col(map, 'invested', 'invested amount', 'buy value')
  const iValue = col(map, 'current value', 'cur val', 'market value', 'value')
  const iSip = col(map, 'monthly sip', 'sip')
  const iPrincipal = col(map, 'principal', 'fd amount')
  const iRate = col(map, 'interest rate', 'rate')
  const iStart = col(map, 'start date', 'start')
  const iMaturity = col(map, 'maturity date', 'maturity')
  const iUnit = col(map, 'unit', 'units', 'uom')

  // Need at least a name/ticker column
  if (iName == null && iTicker == null) return null

  const stocks: Stock[] = []
  const mutualFunds: MutualFund[] = []
  const fixedDeposits: FixedDeposit[] = []
  const otherAssets: OtherAsset[] = []

  for (let r = rowIndex + 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row) continue
    const typeRaw = iType != null ? normalizeHeader(cellStr(row[iType])) : ''
    const name = cellStr(iName != null ? row[iName] : '') || cellStr(iTicker != null ? row[iTicker] : '')
    if (!name) continue
    if (['type', 'name', 'symbol', 'ticker'].includes(normalizeHeader(name))) continue

    const isFd = typeRaw.includes('fd') || typeRaw.includes('fixed')
    const isMf =
      typeRaw.includes('mf') ||
      typeRaw.includes('mutual') ||
      typeRaw.includes('fund') ||
      typeRaw.includes('sip')
    const otherKind = detectOtherAssetKind(typeRaw)
    const isOther = otherKind != null
    const isStock =
      !isFd &&
      !isMf &&
      !isOther &&
      (typeRaw.includes('stock') ||
        typeRaw.includes('equity') ||
        typeRaw.includes('etf') ||
        typeRaw === '' ||
        iQty != null)

    if (isFd) {
      const principal = iPrincipal != null ? cellNum(row[iPrincipal]) : cellNum(iValue != null ? row[iValue] : 0)
      if (principal <= 0) continue
      const today = new Date().toISOString().slice(0, 10)
      fixedDeposits.push({
        id: createId(),
        name,
        principal,
        interestRate: iRate != null ? cellNum(row[iRate]) : 0,
        startDate: iStart != null ? cellStr(row[iStart]) || today : today,
        maturityDate: iMaturity != null ? cellStr(row[iMaturity]) || today : today,
      })
      continue
    }

    if (isMf) {
      const invested =
        iInvested != null
          ? cellNum(row[iInvested])
          : (iQty != null && iBuy != null ? cellNum(row[iQty]) * cellNum(row[iBuy]) : 0)
      const currentValue =
        iValue != null
          ? cellNum(row[iValue])
          : (iQty != null && iCurrent != null ? cellNum(row[iQty]) * cellNum(row[iCurrent]) : invested)
      if (invested <= 0 && currentValue <= 0) continue
      mutualFunds.push({
        id: createId(),
        name,
        investedAmount: invested || currentValue,
        currentValue: currentValue || invested,
        monthlySip: iSip != null ? cellNum(row[iSip]) : 0,
      })
      continue
    }

    if (isOther && otherKind) {
      const quantity = iQty != null ? cellNum(row[iQty]) : 0
      if (quantity <= 0) continue
      const buyPrice =
        iBuy != null
          ? cellNum(row[iBuy])
          : iInvested != null && quantity
            ? cellNum(row[iInvested]) / quantity
            : 0
      const currentPrice =
        iCurrent != null
          ? cellNum(row[iCurrent])
          : iValue != null && quantity
            ? cellNum(row[iValue]) / quantity
            : buyPrice
      const unitRaw = iUnit != null ? cellStr(row[iUnit]) : ''
      otherAssets.push({
        id: createId(),
        name,
        kind: otherKind,
        quantity,
        unit: unitRaw || defaultUnitForKind(otherKind),
        buyPrice,
        currentPrice: currentPrice || buyPrice,
      })
      continue
    }

    if (isStock) {
      const quantity = iQty != null ? cellNum(row[iQty]) : 0
      if (quantity <= 0) continue
      const buyPrice =
        iBuy != null
          ? cellNum(row[iBuy])
          : iInvested != null && quantity
            ? cellNum(row[iInvested]) / quantity
            : 0
      let currentPrice =
        iCurrent != null
          ? cellNum(row[iCurrent])
          : iValue != null && quantity
            ? cellNum(row[iValue]) / quantity
            : buyPrice
      stocks.push({
        id: createId(),
        name,
        ticker: cellStr(iTicker != null ? row[iTicker] : '') || undefined,
        quantity,
        buyPrice,
        currentPrice: currentPrice || buyPrice,
      })
    }
  }

  if (stocks.length + mutualFunds.length + fixedDeposits.length + otherAssets.length === 0) return null

  return {
    format: 'Generic holdings',
    stocks,
    mutualFunds,
    fixedDeposits,
    otherAssets,
    trades: [],
    warnings: [],
    notes: [
      stocks.length ? `${stocks.length} stock(s)` : '',
      mutualFunds.length ? `${mutualFunds.length} mutual fund(s)` : '',
      fixedDeposits.length ? `${fixedDeposits.length} FD(s)` : '',
      otherAssets.length ? `${otherAssets.length} other asset(s)` : '',
    ].filter(Boolean),
  }
}

function detectOtherAssetKind(typeRaw: string): OtherAssetKind | null {
  if (!typeRaw) return null
  if (typeRaw.includes('gold') || typeRaw.includes('jewellery') || typeRaw.includes('jewelry')) {
    return 'gold'
  }
  if (typeRaw.includes('silver')) return 'silver'
  if (
    typeRaw.includes('other') ||
    typeRaw.includes('commodity') ||
    typeRaw.includes('metal') ||
    typeRaw === 'asset'
  ) {
    return 'other'
  }
  return null
}

/** Parse Zerodha Tax P&L — open positions + best-effort equity/MF clues. */
function parseZerodhaTaxPnl(wb: WorkbookData): ImportResult {
  const stocks: Stock[] = []
  const mutualFunds: MutualFund[] = []
  const warnings: string[] = []
  const notes: string[] = []

  // Open positions sheets (equity rarely present; F&O/currency/commodity supported)
  for (const sheetName of wb.sheetNames) {
    if (!sheetName.toLowerCase().includes('open position')) continue
    const rows = wb.sheets[sheetName]
    let section: 'equity' | 'fo' | 'other' | null = null
    let headerMap: HeaderMap | null = null

    for (let i = 0; i < rows.length; i++) {
      const first = cellStr(rows[i]?.[0])
      const lower = first.toLowerCase()
      if (lower.includes('open positions for equity') || lower === 'equity') section = 'equity'
      else if (lower.includes('open positions for f')) section = 'fo'
      else if (lower.includes('open positions for')) section = 'other'

      if (normalizeHeader(first) === 'symbol') {
        headerMap = {}
        rows[i].forEach((c, idx) => {
          const h = normalizeHeader(cellStr(c))
          if (h) headerMap![h] = idx
        })
        continue
      }

      if (!headerMap || !section) continue
      if (!first || lower.startsWith('open positions') || lower.startsWith('client')) {
        if (lower.startsWith('open positions')) headerMap = null
        continue
      }

      const iSym = col(headerMap, 'symbol')
      const iQty = col(headerMap, 'open quantity', 'quantity', 'qty')
      const iAvg = col(headerMap, 'average price', 'avg')
      const iClose = col(headerMap, 'previous closing', 'closing price', 'ltp')
      if (iSym == null || iQty == null) continue

      const symbol = cellStr(rows[i][iSym])
      const quantity = cellNum(rows[i][iQty])
      if (!symbol || quantity <= 0) continue
      if (normalizeHeader(symbol) === 'symbol') continue

      const buyPrice = iAvg != null ? cellNum(rows[i][iAvg]) : 0
      const currentPrice = iClose != null ? cellNum(rows[i][iClose]) : buyPrice

      // F&O/currency open positions still tracked as stock-like positions for visibility
      stocks.push({
        id: createId(),
        name: symbol,
        ticker: symbol,
        quantity,
        buyPrice,
        currentPrice: currentPrice || buyPrice,
      })
    }
  }

  // Equity Dividends → approximate holdings (qty known; prices unknown)
  const divSheet = wb.sheetNames.find((n) => n.toLowerCase().includes('dividend'))
  if (divSheet) {
    const rows = wb.sheets[divSheet]
    const found = findHeaderRow(rows, ['symbol', 'ex date', 'dividend'])
    if (found) {
      const iSym = col(found.map, 'symbol')!
      const iQty = col(found.map, 'quantity', 'qty')
      const bySymbol = new Map<string, number>()
      for (let r = found.rowIndex + 1; r < rows.length; r++) {
        const sym = cellStr(rows[r][iSym])
        if (!sym || normalizeHeader(sym) === 'symbol') continue
        const qty = iQty != null ? cellNum(rows[r][iQty]) : 0
        if (qty <= 0) continue
        // Keep latest/max qty seen for the symbol
        bySymbol.set(sym, Math.max(bySymbol.get(sym) ?? 0, qty))
      }

      if (stocks.length === 0 && bySymbol.size > 0) {
        for (const [symbol, quantity] of bySymbol) {
          stocks.push({
            id: createId(),
            name: symbol,
            ticker: symbol,
            quantity,
            buyPrice: 0,
            currentPrice: 0,
          })
        }
        warnings.push(
          'Tax P&L has no open equity positions. Approximate holdings were inferred from Equity Dividends (quantity only — set buy/current prices manually).',
        )
        notes.push(`Inferred ${bySymbol.size} stock(s) from dividend records`)
      }
    }
  }

  // Mutual Funds sheet — realized trades only (not current holdings)
  const mfSheet = wb.sheetNames.find((n) => normalizeHeader(n) === 'mutual funds')
  if (mfSheet) {
    const rows = wb.sheets[mfSheet]
    let inTrades = false
    let headerMap: HeaderMap | null = null
    for (let i = 0; i < rows.length; i++) {
      const first = cellStr(rows[i]?.[0])
      const lower = first.toLowerCase()
      if (lower.includes('short term trades') || lower.includes('long term trades') || lower.includes('debt - purchases')) {
        inTrades = true
        headerMap = null
        continue
      }
      if (!inTrades) continue
      if (normalizeHeader(first) === 'symbol') {
        headerMap = {}
        rows[i].forEach((c, idx) => {
          const h = normalizeHeader(cellStr(c))
          if (h) headerMap![h] = idx
        })
        continue
      }
      if (!headerMap) continue
      if (!first) continue
      if (lower.includes('trades') || lower.includes('purchases')) {
        headerMap = null
        continue
      }
      const iSym = col(headerMap, 'symbol')
      const iBuy = col(headerMap, 'buy value')
      const iSell = col(headerMap, 'sell value')
      if (iSym == null) continue
      const symbol = cellStr(rows[i][iSym])
      if (!symbol || normalizeHeader(symbol) === 'symbol') continue
      const buy = iBuy != null ? cellNum(rows[i][iBuy]) : 0
      const sell = iSell != null ? cellNum(rows[i][iSell]) : 0
      // Sold MF lots — skip as holdings; note only
      if (buy || sell) {
        notes.push(`MF trade in report (not imported as holding): ${symbol}`)
      }
    }
  }

  if (stocks.length === 0 && mutualFunds.length === 0) {
    warnings.push(
      'This looks like a Zerodha Tax P&L report. It tracks realized trades, not current equity holdings. For holdings, download Console → Holdings → export CSV/Excel, or use our template.',
    )
  } else if (!warnings.length) {
    notes.push(`Imported ${stocks.length} open position(s) from Tax P&L`)
  }

  return {
    format: 'Zerodha Tax P&L',
    stocks,
    mutualFunds,
    fixedDeposits: [],
    otherAssets: [],
    trades: [],
    warnings,
    notes: notes.filter((n, i, a) => a.indexOf(n) === i).slice(0, 8),
  }
}

function emptyResult(format: string, warnings: string[]): ImportResult {
  return {
    format,
    stocks: [],
    mutualFunds: [],
    fixedDeposits: [],
    otherAssets: [],
    trades: [],
    warnings,
    notes: [],
  }
}

/** Detect format and parse investments from a workbook. */
export function parseInvestmentsWorkbook(wb: WorkbookData, sourceFile?: string): ImportResult {
  // Prefer first sheet for holdings-style files
  const primary = wb.sheets[wb.sheetNames[0]] ?? []

  if (isZerodhaTaxPnl(wb)) {
    return parseZerodhaTaxPnl(wb)
  }

  // Merge every tradebook sheet in the file (not just the first match)
  const tradebookSheets = wb.sheetNames.filter((name) => isTradebook(wb.sheets[name]))
  if (tradebookSheets.length > 0) {
    const mergedTrades: Trade[] = []
    const warnings: string[] = []
    const notes: string[] = []

    for (const name of tradebookSheets) {
      const parsed = parseTradebook(wb.sheets[name], sourceFile)
      mergedTrades.push(...parsed.trades)
      warnings.push(...parsed.warnings)
      if (tradebookSheets.length > 1) {
        notes.push(`Sheet “${name}”: ${parsed.trades.length} trade(s)`)
      } else {
        notes.push(...parsed.notes)
      }
    }

    // Deduplicate within the same file
    const seen = new Set<string>()
    const trades = mergedTrades.filter((t) => {
      const key = t.tradeId || `${t.symbol}|${t.tradeDate}|${t.tradeType}|${t.quantity}|${t.price}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    const analysis = analyzeTradebook(trades)
    return {
      format: 'Tradebook',
      stocks: analysis.positions,
      mutualFunds: [],
      fixedDeposits: [],
      otherAssets: [],
      trades,
      realizedPnl: analysis.realizedPnl,
      unrealizedPnl: analysis.unrealizedPnl,
      warnings: [...new Set([...warnings, ...analysis.warnings])],
      notes:
        tradebookSheets.length > 1
          ? [
              `${tradebookSheets.length} tradebook sheet(s) · ${trades.length} equity trade(s) after dedupe`,
              ...notes,
              `Realized P&L ${analysis.realizedPnl >= 0 ? '+' : ''}${analysis.realizedPnl.toLocaleString()} · Unrealized ${analysis.unrealizedPnl >= 0 ? '+' : ''}${analysis.unrealizedPnl.toLocaleString()}`,
              'Import multiple tradebooks to build full history (duplicates are skipped by trade_id).',
            ]
          : notes,
    }
  }

  if (isZerodhaHoldings(primary)) {
    return parseZerodhaHoldings(primary)
  }

  // Try every sheet for generic / holdings
  for (const name of wb.sheetNames) {
    const rows = wb.sheets[name]
    if (isZerodhaHoldings(rows)) return parseZerodhaHoldings(rows)
    const generic = parseGenericHoldings(rows)
    if (generic) return generic
  }

  const generic = parseGenericHoldings(primary)
  if (generic) return generic

  return emptyResult('Unknown', [
    'Could not detect holdings or tradebook columns. Supported: Zerodha tradebook (symbol, trade_type, quantity, price), holdings CSV, or our template.',
  ])
}

export function mergeByTickerOrName<T extends { name: string; ticker?: string }>(
  existing: T[],
  incoming: T[],
  keyFn: (item: T) => string = (item) =>
    (item.ticker || item.name).toLowerCase().replace(/\s+/g, ''),
): T[] {
  const map = new Map<string, T>()
  for (const item of existing) map.set(keyFn(item), item)
  for (const item of incoming) map.set(keyFn(item), item)
  return [...map.values()]
}
