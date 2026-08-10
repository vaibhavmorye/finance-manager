import type { CorporateExitType, Stock, Trade } from '@/types/finance'
import { createId } from '@/types/finance'

export interface Lot {
  qty: number
  price: number
  buyDate: string
}

/** Open short (sell without inventory), later covered by a buy. */
interface ShortLot {
  qty: number
  price: number
  sellDate: string
  sellTradeId?: string
  exitType?: CorporateExitType
}

export type ClosedTradeFlag =
  | 'ipo'
  | 'rights'
  | 'split'
  | CorporateExitType

/** One FIFO-matched closed slice (buy ↔ sell). */
export interface ClosedTradeRow {
  id: string
  symbol: string
  quantity: number
  buyDate: string
  sellDate: string
  /**
   * Indian financial-year start year of the sell (Apr–Mar).
   * e.g. sell on 2018-02-10 → 2017 (FY 2017-18); sell on 2018-04-01 → 2018 (FY 2018-19).
   * Closed trades are attributed to the FY of the sell, not the buy.
   */
  sellYear: number
  buyPrice: number
  sellPrice: number
  buyValue: number
  sellValue: number
  pnl: number
  pnlPercent: number
  holdingDays: number
  /** Origin / corporate-action tag for this exit. */
  flag?: ClosedTradeFlag
  /** Broker trade id of the sell fill (for updating exitType). */
  sellTradeId?: string
}

export const CORPORATE_EXIT_OPTIONS: { value: CorporateExitType; label: string }[] = [
  { value: 'buyback', label: 'Buyback' },
  { value: 'open_offer', label: 'Open offer' },
  { value: 'tender', label: 'Tender offer' },
  { value: 'delisting', label: 'Delisting' },
  { value: 'merger', label: 'Merger / amalgamation' },
]

export function corporateExitLabel(flag?: ClosedTradeFlag | null): string | null {
  if (!flag) return null
  if (flag === 'ipo') return 'IPO'
  if (flag === 'rights') return 'Rights'
  if (flag === 'split') return 'Split'
  return CORPORATE_EXIT_OPTIONS.find((o) => o.value === flag)?.label ?? flag
}

export interface YearPnlSummary {
  /** Indian FY start year (same as ClosedTradeRow.sellYear). */
  year: number
  /** Display label e.g. "FY 2017-18". */
  label: string
  trades: number
  quantity: number
  buyValue: number
  sellValue: number
  realizedPnl: number
  wins: number
  losses: number
}

/**
 * Indian financial year start year for a date (YYYY-MM-DD or ISO).
 * Apr 1 YYYY … Mar 31 YYYY+1 → start year YYYY.
 */
export function financialYearStart(date: string): number {
  const y = Number(date.slice(0, 4))
  const m = Number(date.slice(5, 7))
  if (!Number.isFinite(y)) return new Date().getFullYear()
  if (!Number.isFinite(m) || m < 1) return y
  // Jan–Mar belong to the FY that started the previous calendar year
  return m >= 4 ? y : y - 1
}

/** Format FY start year as "FY 2017-18". */
export function formatFinancialYear(startYear: number): string {
  if (!Number.isFinite(startYear) || startYear <= 0) return 'FY —'
  const end = String((startYear + 1) % 100).padStart(2, '0')
  return `FY ${startYear}-${end}`
}

/** Remaining open buy lot. */
export interface OpenLotRow {
  id: string
  symbol: string
  quantity: number
  buyDate: string
  buyPrice: number
  currentPrice: number
  unrealizedPnl: number
  unrealizedPercent: number
  invested: number
  marketValue: number
}

export interface SymbolPnl {
  symbol: string
  realizedPnl: number
  sellQty: number
  buyQty: number
  openQty: number
  avgCost: number
  lastPrice: number
  unrealizedPnl: number
  invested: number
  marketValue: number
}

export interface TradebookAnalysis {
  positions: Stock[]
  closedTrades: ClosedTradeRow[]
  openLots: OpenLotRow[]
  bySellYear: YearPnlSummary[]
  realizedPnl: number
  unrealizedPnl: number
  totalInvested: number
  marketValue: number
  bySymbol: SymbolPnl[]
  warnings: string[]
  tradeCount: number
  buyCount: number
  sellCount: number
}

function roundQty(n: number): number {
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

function tradeTime(t: Trade): string {
  return t.orderExecutionTime || t.tradeDate
}

/** Strip spaces/punctuation so "URJA GLOBAL" and "URJAGLOBAL" match. */
export function normalizeSymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/**
 * Rights / T2T corp-action tickers credited outside the tradebook
 * (e.g. URJA-RE, SYMBOL-BE). Selling these is not a true short.
 */
export function isCorporateActionSymbol(symbol: string): boolean {
  const s = symbol.toUpperCase().trim()
  return /-(RE|BE|BL|SG|PP\d*|N\d+|Z\d+|A1|W\d*)$/.test(s)
}

/** Likely NSE/BSE truncation of the same ticker (URJAGLOBAL ↔ URJAGLOBA). */
export function isTruncatedSymbolPair(a: string, b: string): boolean {
  const x = normalizeSymbol(a)
  const y = normalizeSymbol(b)
  if (!x || !y || x === y) return x === y
  const [shorter, longer] = x.length <= y.length ? [x, y] : [y, x]
  if (shorter.length < 6) return false
  return longer.startsWith(shorter) && longer.length - shorter.length <= 3
}

interface PositionIdentity {
  /** Stable lot key (ISIN when known, else normalized symbol). */
  keyFor(trade: Trade): string
  resolveIsin(trade: Trade): string | undefined
  /** Best display ticker for a lot key. */
  displaySymbol(key: string): string
  /** Whether this key is a corporate-action instrument. */
  isCorpAction(key: string): boolean
}

/**
 * Resolve lot identity across symbol renames / spacing / truncation using ISIN,
 * with normalized-symbol fallback.
 */
export function buildPositionIdentity(trades: Trade[]): PositionIdentity {
  const normToIsin = new Map<string, string>()
  const isinToNorms = new Map<string, Set<string>>()
  const keyToDisplay = new Map<string, string>()
  const keyIsCorp = new Map<string, boolean>()

  const rememberDisplay = (key: string, symbol: string) => {
    const prev = keyToDisplay.get(key)
    // Prefer non-CA symbol, then longer / more recent label
    if (!prev) {
      keyToDisplay.set(key, symbol)
      return
    }
    const prevCa = isCorporateActionSymbol(prev)
    const nextCa = isCorporateActionSymbol(symbol)
    if (prevCa && !nextCa) keyToDisplay.set(key, symbol)
    else if (!prevCa && nextCa) return
    else if (symbol.length >= prev.length) keyToDisplay.set(key, symbol)
  }

  // Pass 1: learn ISIN ↔ symbol from rows that have both
  for (const t of trades) {
    const isin = t.isin?.trim().toUpperCase()
    const norm = normalizeSymbol(t.symbol)
    if (!isin || !norm) continue
    normToIsin.set(norm, isin)
    let set = isinToNorms.get(isin)
    if (!set) {
      set = new Set()
      isinToNorms.set(isin, set)
    }
    set.add(norm)
  }

  // Pass 2: link truncated spellings to the same ISIN when one side is known
  const norms = [...new Set(trades.map((t) => normalizeSymbol(t.symbol)).filter(Boolean))]
  for (const n of norms) {
    if (normToIsin.has(n)) continue
    for (const [known, isin] of normToIsin) {
      if (isTruncatedSymbolPair(n, known)) {
        normToIsin.set(n, isin)
        isinToNorms.get(isin)?.add(n)
        break
      }
    }
  }

  // Pass 3: without ISIN, cluster truncated spellings onto the longest norm as key
  const rootOf = new Map<string, string>()
  const find = (n: string): string => {
    const p = rootOf.get(n)
    if (!p || p === n) {
      rootOf.set(n, n)
      return n
    }
    const r = find(p)
    rootOf.set(n, r)
    return r
  }
  const union = (a: string, b: string) => {
    const ra = find(a)
    const rb = find(b)
    if (ra === rb) return
    // Prefer longer token as root (less truncated)
    if (ra.length >= rb.length) rootOf.set(rb, ra)
    else rootOf.set(ra, rb)
  }
  for (let i = 0; i < norms.length; i++) {
    for (let j = i + 1; j < norms.length; j++) {
      if (isTruncatedSymbolPair(norms[i], norms[j])) union(norms[i], norms[j])
    }
  }

  const keyFor = (trade: Trade): string => {
    const norm = normalizeSymbol(trade.symbol)
    const rawIsin = trade.isin?.trim().toUpperCase()
    const isin = rawIsin || normToIsin.get(norm)
    if (isin) return `isin:${isin}`
    const root = norm ? find(norm) : normalizeSymbol(trade.symbol)
    return `sym:${root || trade.symbol.toUpperCase()}`
  }

  /** Fill empty trade.isin from the learned symbol map (mutates a copy upstream if desired). */
  const resolveIsin = (trade: Trade): string | undefined => {
    const raw = trade.isin?.trim().toUpperCase()
    if (raw) return raw
    return normToIsin.get(normalizeSymbol(trade.symbol))
  }

  for (const t of trades) {
    const key = keyFor(t)
    rememberDisplay(key, t.symbol)
    if (isCorporateActionSymbol(t.symbol)) keyIsCorp.set(key, true)
  }

  return {
    keyFor,
    resolveIsin,
    displaySymbol: (key) => keyToDisplay.get(key) || key.replace(/^(isin|sym):/, ''),
    isCorpAction: (key) => keyIsCorp.get(key) === true || isCorporateActionSymbol(keyToDisplay.get(key) || ''),
  }
}

/**
 * Detect a simple stock split / bonus when sell qty is an integer multiple of
 * open qty and price roughly scales inversely (e.g. Ashok Leyland 20 @ ₹236 → 40 @ ₹130).
 */
export function maybeApplyQuantitySplit(longs: Lot[], sellQty: number, sellPrice: number): number | null {
  const openQty = longs.reduce((s, l) => s + l.qty, 0)
  if (openQty <= 1e-9 || sellQty <= openQty + 1e-9) return null
  const ratio = Math.round(sellQty / openQty)
  if (ratio < 2 || ratio > 20) return null
  if (Math.abs(sellQty - openQty * ratio) > 1e-6) return null
  const avgCost = longs.reduce((s, l) => s + l.qty * l.price, 0) / openQty
  const expected = avgCost / ratio
  if (expected <= 0) return null
  // Allow wide band — post-split market can gap
  if (sellPrice > expected * 3 || sellPrice < expected * 0.25) return null
  for (const lot of longs) {
    lot.qty = roundQty(lot.qty * ratio)
    lot.price = lot.price / ratio
  }
  return ratio
}
function resolveMarkPrice(
  symbol: string,
  priceOverrides: Record<string, number>,
  lastPrice: Map<string, number>,
  avgCost: number,
): number {
  const key = symbol.toUpperCase()
  const norm = normalizeSymbol(symbol)
  const override =
    priceOverrides[symbol] ??
    priceOverrides[key] ??
    priceOverrides[symbol.toLowerCase()] ??
    priceOverrides[norm]
  if (override != null && override > 0) return override
  const last = lastPrice.get(symbol) ?? lastPrice.get(norm)
  if (last != null && last > 0) return last
  return avgCost
}

export function tradeDedupKey(t: Pick<Trade, 'tradeId' | 'symbol' | 'tradeDate' | 'tradeType' | 'quantity' | 'price' | 'orderId'>): string {
  if (t.tradeId) return `id:${t.tradeId}`
  return `h:${t.symbol}|${t.tradeDate}|${t.tradeType}|${t.quantity}|${t.price}|${t.orderId ?? ''}`
}

/** Merge trade lists, deduping by broker trade id / fingerprint. */
export function mergeTrades(existing: Trade[], incoming: Trade[]): { trades: Trade[]; added: number; skipped: number } {
  const map = new Map<string, Trade>()
  for (const t of existing) map.set(tradeDedupKey(t), t)
  let added = 0
  let skipped = 0
  for (const t of incoming) {
    const key = tradeDedupKey(t)
    const prev = map.get(key)
    if (prev) {
      skipped++
      // Keep user exit tags when re-importing the same broker trade
      if (prev.exitType && !t.exitType) {
        map.set(key, { ...t, id: prev.id, exitType: prev.exitType })
      }
      continue
    }
    map.set(key, t)
    added++
  }
  const trades = [...map.values()].sort((a, b) => tradeTime(a).localeCompare(tradeTime(b)))
  return { trades, added, skipped }
}

/**
 * FIFO analysis of full trade history.
 * - Sell-before-buy (intraday short / MIS) is covered by later buys
 * - Same ISIN / truncated / spaced tickers share one lot queue
 * - Rights/BE-style corp-action sells without a buy use cost basis 0
 * `priceOverrides` — optional LTP by symbol (e.g. from existing stock.currentPrice).
 */
export function analyzeTradebook(
  trades: Trade[],
  priceOverrides: Record<string, number> = {},
): TradebookAnalysis {
  const identity = buildPositionIdentity(trades)
  const sorted = [...trades].sort((a, b) => {
    const byTime = tradeTime(a).localeCompare(tradeTime(b))
    if (byTime !== 0) return byTime
    // Same timestamp: process buys before sells so cover+open same second nets cleanly
    if (a.tradeType !== b.tradeType) return a.tradeType === 'buy' ? -1 : 1
    return 0
  })

  const longLots = new Map<string, Lot[]>()
  const shortLots = new Map<string, ShortLot[]>()
  const realized = new Map<string, number>()
  const sellQty = new Map<string, number>()
  const buyQty = new Map<string, number>()
  const lastPrice = new Map<string, number>()
  const closedTrades: ClosedTradeRow[] = []
  let buyCount = 0
  let sellCount = 0
  let corpActionCredits = 0
  let splitAdjustments = 0
  let allotmentCredits = 0

  const ensureQueues = (key: string) => {
    if (!longLots.has(key)) longLots.set(key, [])
    if (!shortLots.has(key)) shortLots.set(key, [])
  }

  const pushClosed = (row: Omit<ClosedTradeRow, 'id' | 'sellYear' | 'pnlPercent' | 'holdingDays' | 'buyValue' | 'sellValue'> & {
    buyValue?: number
    sellValue?: number
    flag?: ClosedTradeFlag
    sellTradeId?: string
  }) => {
    const buyValue = row.buyValue ?? roundMoney(row.quantity * row.buyPrice)
    const sellValue = row.sellValue ?? roundMoney(row.quantity * row.sellPrice)
    closedTrades.push({
      id: createId(),
      symbol: row.symbol,
      quantity: row.quantity,
      buyDate: row.buyDate,
      sellDate: row.sellDate,
      sellYear: financialYearStart(row.sellDate),
      buyPrice: row.buyPrice,
      sellPrice: row.sellPrice,
      buyValue,
      sellValue,
      pnl: row.pnl,
      pnlPercent: row.buyPrice > 0 ? roundMoney((row.pnl / (row.buyPrice * row.quantity)) * 100) : 0,
      holdingDays: dayDiff(row.buyDate, row.sellDate),
      flag: row.flag,
      sellTradeId: row.sellTradeId,
    })
  }

  /** Close a short against a synthetic zero-cost credit (rights or IPO). */
  const creditCorpActionAndClose = (
    key: string,
    display: string,
    shorts: ShortLot[],
    flag: 'ipo' | 'rights',
  ) => {
    while (shorts.length > 0) {
      const short = shorts[0]
      const take = short.qty
      if (take <= 1e-9) {
        shorts.shift()
        continue
      }
      const slicePnl = short.price * take
      if (flag === 'rights') corpActionCredits++
      pushClosed({
        symbol: display,
        quantity: roundQty(take),
        buyDate: short.sellDate,
        sellDate: short.sellDate,
        buyPrice: 0,
        sellPrice: roundMoney(short.price),
        pnl: roundMoney(slicePnl),
        flag: short.exitType ?? flag,
        sellTradeId: short.sellTradeId,
      })
      realized.set(key, (realized.get(key) ?? 0) + slicePnl)
      sellQty.set(key, (sellQty.get(key) ?? 0) + take)
      shorts.shift()
    }
  }

  for (const t of sorted) {
    const key = identity.keyFor(t)
    const display = identity.displaySymbol(key)
    ensureQueues(key)
    lastPrice.set(display, t.price)
    lastPrice.set(normalizeSymbol(t.symbol), t.price)
    const longs = longLots.get(key)!
    const shorts = shortLots.get(key)!

    if (t.tradeType === 'buy') {
      buyCount++
      buyQty.set(key, (buyQty.get(key) ?? 0) + t.quantity)
      let remaining = t.quantity
      const buyDate = t.tradeDate || tradeTime(t).slice(0, 10)
      let pnl = 0
      let matched = 0

      // Cover open shorts first (sell-then-buy intraday)
      while (remaining > 1e-9 && shorts.length > 0) {
        const short = shorts[0]
        const take = Math.min(short.qty, remaining)
        const slicePnl = (short.price - t.price) * take
        pnl += slicePnl
        matched += take
        pushClosed({
          symbol: display,
          quantity: roundQty(take),
          buyDate,
          sellDate: short.sellDate,
          buyPrice: roundMoney(t.price),
          sellPrice: roundMoney(short.price),
          pnl: roundMoney(slicePnl),
          flag: short.exitType,
          sellTradeId: short.sellTradeId,
        })
        short.qty -= take
        remaining -= take
        if (short.qty <= 1e-9) shorts.shift()
      }

      if (matched > 0) {
        realized.set(key, (realized.get(key) ?? 0) + pnl)
        sellQty.set(key, (sellQty.get(key) ?? 0) + matched)
      }

      if (remaining > 1e-9) {
        longs.push({
          qty: remaining,
          price: t.price,
          buyDate,
        })
      }
      continue
    }

    // sell
    sellCount++
    let remaining = t.quantity
    let pnl = 0
    let matched = 0
    const sellDate = t.tradeDate || tradeTime(t).slice(0, 10)

    const openBefore = longs.reduce((s, l) => s + l.qty, 0)
    if (remaining > openBefore + 1e-9 && openBefore > 1e-9) {
      const ratio = maybeApplyQuantitySplit(longs, remaining, t.price)
      if (ratio) splitAdjustments++
    }

    while (remaining > 1e-9 && longs.length > 0) {
      const lot = longs[0]
      const take = Math.min(lot.qty, remaining)
      const slicePnl = (t.price - lot.price) * take
      pnl += slicePnl
      matched += take
      pushClosed({
        symbol: display,
        quantity: roundQty(take),
        buyDate: lot.buyDate,
        sellDate,
        buyPrice: roundMoney(lot.price),
        sellPrice: roundMoney(t.price),
        pnl: roundMoney(slicePnl),
        flag: t.exitType,
        sellTradeId: t.tradeId,
      })
      lot.qty -= take
      remaining -= take
      if (lot.qty <= 1e-9) longs.shift()
    }

    if (matched > 0) {
      realized.set(key, (realized.get(key) ?? 0) + pnl)
      sellQty.set(key, (sellQty.get(key) ?? 0) + matched)
    }

    // Leftover sell qty: corp-action credit at cost 0, else open short
    if (remaining > 1e-9) {
      if (isCorporateActionSymbol(t.symbol) || identity.isCorpAction(key)) {
        corpActionCredits++
        const slicePnl = t.price * remaining
        pushClosed({
          symbol: display,
          quantity: roundQty(remaining),
          buyDate: sellDate,
          sellDate,
          buyPrice: 0,
          sellPrice: roundMoney(t.price),
          pnl: roundMoney(slicePnl),
          flag: t.exitType ?? 'rights',
          sellTradeId: t.tradeId,
        })
        realized.set(key, (realized.get(key) ?? 0) + slicePnl)
        sellQty.set(key, (sellQty.get(key) ?? 0) + remaining)
      } else {
        shorts.push({
          qty: remaining,
          price: t.price,
          sellDate,
          sellTradeId: t.tradeId,
          exitType: t.exitType,
        })
      }
    }
  }

  // Any leftover shorts on corp-action keys → cost-0 rights credit
  for (const [key, shorts] of shortLots) {
    if (!shorts.length) continue
    if (!identity.isCorpAction(key)) continue
    creditCorpActionAndClose(key, identity.displaySymbol(key), shorts, 'rights')
  }

  // Sell-only names (IPO allotment never in tradebook as buy)
  for (const [key, shorts] of shortLots) {
    if (!shorts.length) continue
    const bought = buyQty.get(key) ?? 0
    if (bought > 1e-9) continue
    const before = shorts.length
    creditCorpActionAndClose(key, identity.displaySymbol(key), shorts, 'ipo')
    if (before > 0) allotmentCredits++
  }

  const bySymbol: SymbolPnl[] = []
  const positions: Stock[] = []
  const openLots: OpenLotRow[] = []
  let realizedPnl = 0

  const openShortSymbols: string[] = []
  for (const [key, shorts] of shortLots) {
    const openShortQty = shorts.reduce((s, l) => s + l.qty, 0)
    if (openShortQty > 1e-6) openShortSymbols.push(identity.displaySymbol(key))
  }

  const ledgerKeys = new Set<string>([
    ...longLots.keys(),
    ...shortLots.keys(),
    ...realized.keys(),
  ])

  for (const key of [...ledgerKeys].sort()) {
    const display = identity.displaySymbol(key)
    const queue = longLots.get(key) ?? []
    const openQty = queue.reduce((s, l) => s + l.qty, 0)
    const cost = queue.reduce((s, l) => s + l.qty * l.price, 0)
    const avgCost = openQty > 1e-9 ? cost / openQty : 0
    const mark = resolveMarkPrice(display, priceOverrides, lastPrice, avgCost)
    const unrealized = openQty > 1e-9 ? (mark - avgCost) * openQty : 0
    const r = realized.get(key) ?? 0

    realizedPnl += r

    bySymbol.push({
      symbol: display,
      realizedPnl: roundMoney(r),
      sellQty: roundQty(sellQty.get(key) ?? 0),
      buyQty: roundQty(buyQty.get(key) ?? 0),
      openQty: roundQty(openQty),
      avgCost: roundMoney(avgCost),
      lastPrice: roundMoney(mark),
      unrealizedPnl: roundMoney(unrealized),
      invested: roundMoney(cost),
      marketValue: roundMoney(openQty * mark),
    })

    for (const lot of queue) {
      if (lot.qty <= 1e-9) continue
      const u = (mark - lot.price) * lot.qty
      openLots.push({
        id: createId(),
        symbol: display,
        quantity: roundQty(lot.qty),
        buyDate: lot.buyDate,
        buyPrice: roundMoney(lot.price),
        currentPrice: roundMoney(mark),
        unrealizedPnl: roundMoney(u),
        unrealizedPercent: lot.price > 0 ? roundMoney(((mark - lot.price) / lot.price) * 100) : 0,
        invested: roundMoney(lot.qty * lot.price),
        marketValue: roundMoney(lot.qty * mark),
      })
    }

    if (openQty > 1e-6) {
      positions.push({
        id: createId(),
        name: display,
        ticker: display,
        quantity: roundQty(openQty),
        buyPrice: roundMoney(avgCost),
        currentPrice: roundMoney(mark),
      })
    }
  }

  const totalInvested = roundMoney(openLots.reduce((s, l) => s + l.invested, 0))
  const marketValue = roundMoney(openLots.reduce((s, l) => s + l.marketValue, 0))
  const unrealizedPnl = roundMoney(openLots.reduce((s, l) => s + l.unrealizedPnl, 0))

  closedTrades.sort((a, b) => b.sellDate.localeCompare(a.sellDate) || a.symbol.localeCompare(b.symbol))
  openLots.sort((a, b) => a.symbol.localeCompare(b.symbol) || a.buyDate.localeCompare(b.buyDate))

  const bySellYear = summarizeBySellYear(closedTrades)

  const warnings: string[] = []
  if (openShortSymbols.length) {
    warnings.push(
      `Open short / unmatched sell qty for: ${openShortSymbols.slice(0, 8).join(', ')}${openShortSymbols.length > 8 ? '…' : ''}. Often delivery sold from holdings bought before this tradebook, demat transfers, or bonus/split qty not in the ledger — import older tradebooks if you have them.`,
    )
  }
  if (corpActionCredits > 0) {
    warnings.push(
      `Treated ${corpActionCredits} rights/BE-style sell(s) as corporate-action credits (cost ₹0) because no matching buy appears in the tradebook.`,
    )
  }
  if (splitAdjustments > 0) {
    warnings.push(
      `Applied ${splitAdjustments} inferred stock split/bonus adjustment(s) where sell qty was an integer multiple of open qty with scaled price.`,
    )
  }
  if (allotmentCredits > 0) {
    warnings.push(
      `Flagged ${allotmentCredits} IPO sell(s) (cost ₹0) — no buy exists in the imported ledger (IPO allotment).`,
    )
  }

  return {
    positions,
    closedTrades,
    openLots,
    bySellYear,
    realizedPnl: roundMoney(realizedPnl),
    unrealizedPnl,
    totalInvested,
    marketValue,
    bySymbol,
    warnings,
    tradeCount: sorted.length,
    buyCount,
    sellCount,
  }
}

/** Group closed buy↔sell matches by Indian FY of the sell date (Apr–Mar). */
export function summarizeBySellYear(rows: ClosedTradeRow[]): YearPnlSummary[] {
  return groupClosedTradesBySellYear(rows).map((g) => g.summary)
}

export function groupClosedTradesBySellYear(
  rows: ClosedTradeRow[],
): { year: number; summary: YearPnlSummary; trades: AggregatedClosedTrade[] }[] {
  const byYear = new Map<number, ClosedTradeRow[]>()
  for (const r of rows) {
    const year = r.sellYear || financialYearStart(r.sellDate)
    const list = byYear.get(year) ?? []
    list.push(r)
    byYear.set(year, list)
  }

  const years = [...byYear.keys()].sort((a, b) => b - a)
  return years.map((year) => {
    const fills = byYear.get(year) ?? []
    const trades = aggregateClosedTradesBySymbol(fills)
    const summary: YearPnlSummary = {
      year,
      label: formatFinancialYear(year),
      trades: trades.length,
      quantity: roundQty(trades.reduce((s, t) => s + t.quantity, 0)),
      buyValue: roundMoney(trades.reduce((s, t) => s + t.buyValue, 0)),
      sellValue: roundMoney(trades.reduce((s, t) => s + t.sellValue, 0)),
      realizedPnl: roundMoney(trades.reduce((s, t) => s + t.pnl, 0)),
      wins: trades.filter((t) => t.pnl > 0).length,
      losses: trades.filter((t) => t.pnl < 0).length,
    }
    return { year, summary, trades }
  })
}

/** Closed P&L for one symbol with multiple buy/sell fills rolled up. */
export interface AggregatedClosedTrade {
  id: string
  symbol: string
  sellYear: number
  quantity: number
  avgBuyPrice: number
  avgSellPrice: number
  buyValue: number
  sellValue: number
  pnl: number
  pnlPercent: number
  firstBuyDate: string
  lastBuyDate: string
  firstSellDate: string
  lastSellDate: string
  holdingDays: number
  fillCount: number
  /** Present when every fill shares the same origin tag (e.g. IPO / Buyback). */
  flag?: ClosedTradeFlag
  /** Sell trade ids under this aggregate (for updating exitType). */
  sellTradeIds: string[]
  fills: ClosedTradeRow[]
}

/**
 * Aggregate FIFO closed slices by symbol — multiple buys/sells at different
 * rates become one row with weighted-average prices.
 */
export function aggregateClosedTradesBySymbol(rows: ClosedTradeRow[]): AggregatedClosedTrade[] {
  const map = new Map<string, ClosedTradeRow[]>()
  for (const r of rows) {
    const key = r.symbol.toUpperCase()
    const list = map.get(key) ?? []
    list.push(r)
    map.set(key, list)
  }

  const out: AggregatedClosedTrade[] = []
  for (const [, fills] of map) {
    const sorted = [...fills].sort(
      (a, b) => b.sellDate.localeCompare(a.sellDate) || a.buyDate.localeCompare(b.buyDate),
    )
    const quantity = roundQty(sorted.reduce((s, f) => s + f.quantity, 0))
    const buyValue = roundMoney(sorted.reduce((s, f) => s + f.buyValue, 0))
    const sellValue = roundMoney(sorted.reduce((s, f) => s + f.sellValue, 0))
    const pnl = roundMoney(sorted.reduce((s, f) => s + f.pnl, 0))
    const avgBuyPrice = quantity > 0 ? roundMoney(buyValue / quantity) : 0
    const avgSellPrice = quantity > 0 ? roundMoney(sellValue / quantity) : 0
    const buyDates = sorted.map((f) => f.buyDate).sort()
    const sellDates = sorted.map((f) => f.sellDate).sort()
    const firstBuyDate = buyDates[0] ?? ''
    const lastBuyDate = buyDates[buyDates.length - 1] ?? ''
    const firstSellDate = sellDates[0] ?? ''
    const lastSellDate = sellDates[sellDates.length - 1] ?? ''
    const flags = [...new Set(sorted.map((f) => f.flag).filter(Boolean))] as ClosedTradeFlag[]
    const sellTradeIds = [
      ...new Set(sorted.map((f) => f.sellTradeId).filter((id): id is string => Boolean(id))),
    ]
    out.push({
      id: sorted[0]!.id,
      symbol: sorted[0]!.symbol,
      sellYear: sorted[0]!.sellYear,
      quantity,
      avgBuyPrice,
      avgSellPrice,
      buyValue,
      sellValue,
      pnl,
      pnlPercent: buyValue > 0 ? roundMoney((pnl / buyValue) * 100) : 0,
      firstBuyDate,
      lastBuyDate,
      firstSellDate,
      lastSellDate,
      holdingDays: dayDiff(firstBuyDate, lastSellDate),
      fillCount: sorted.length,
      flag: flags.length === 1 ? flags[0] : undefined,
      sellTradeIds,
      fills: sorted,
    })
  }
  return out.sort(
    (a, b) => b.lastSellDate.localeCompare(a.lastSellDate) || a.symbol.localeCompare(b.symbol),
  )
}

/** One open position aggregated across multiple buy lots of the same symbol. */
export interface AggregatedOpenPosition {
  symbol: string
  lotCount: number
  quantity: number
  avgBuyPrice: number
  currentPrice: number
  invested: number
  marketValue: number
  unrealizedPnl: number
  unrealizedPercent: number
  firstBuyDate: string
  lastBuyDate: string
  lots: OpenLotRow[]
}

/** Aggregate open buy lots by symbol (FIFO lots kept under `lots`). */
export function aggregateOpenLotsBySymbol(rows: OpenLotRow[]): AggregatedOpenPosition[] {
  const map = new Map<string, OpenLotRow[]>()
  for (const r of rows) {
    const key = r.symbol.toUpperCase()
    const list = map.get(key) ?? []
    list.push(r)
    map.set(key, list)
  }

  const out: AggregatedOpenPosition[] = []
  for (const [, lots] of map) {
    const sorted = [...lots].sort((a, b) => a.buyDate.localeCompare(b.buyDate))
    const quantity = roundQty(sorted.reduce((s, l) => s + l.quantity, 0))
    const invested = roundMoney(sorted.reduce((s, l) => s + l.invested, 0))
    const marketValue = roundMoney(sorted.reduce((s, l) => s + l.marketValue, 0))
    const unrealizedPnl = roundMoney(sorted.reduce((s, l) => s + l.unrealizedPnl, 0))
    const avgBuyPrice = quantity > 0 ? roundMoney(invested / quantity) : 0
    const currentPrice = sorted[0]?.currentPrice ?? 0
    out.push({
      symbol: sorted[0]!.symbol,
      lotCount: sorted.length,
      quantity,
      avgBuyPrice,
      currentPrice,
      invested,
      marketValue,
      unrealizedPnl,
      unrealizedPercent: invested > 0 ? roundMoney((unrealizedPnl / invested) * 100) : 0,
      firstBuyDate: sorted[0]!.buyDate,
      lastBuyDate: sorted[sorted.length - 1]!.buyDate,
      lots: sorted,
    })
  }
  return out.sort((a, b) => a.symbol.localeCompare(b.symbol))
}
