import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, FileUp, Pencil } from 'lucide-react'
import { Button, Card, Tabs, Input, EmptyState, Modal, StatCard, Badge, Select } from '@/components/ui'
import { ImportInvestmentsModal } from '@/components/ImportInvestmentsModal'
import { useFinanceStore } from '@/store/financeStore'
import { cn, formatCurrency } from '@/lib/utils'
import {
  createId,
  defaultUnitForKind,
  FUND_CATEGORY_LABELS,
  FUND_CATEGORY_OPTIONS,
  OTHER_ASSET_KIND_LABELS,
  OTHER_ASSET_KIND_OPTIONS,
  type FundCategory,
  type MutualFund,
  type MfTransaction,
  type MfTransactionType,
  type OtherAsset,
  type OtherAssetKind,
  type Stock,
} from '@/types/finance'
import { stocksValue, fdValue, mfValue, otherAssetsValue } from '@/lib/finance/networth'
import { analyzeMfTradebook } from '@/lib/finance/mf-tradebook'
import {
  aggregateClosedTradesBySymbol,
  aggregateOpenLotsBySymbol,
  analyzeTradebook,
  CORPORATE_EXIT_OPTIONS,
  corporateExitLabel,
  formatFinancialYear,
  groupClosedTradesBySellYear,
  type AggregatedClosedTrade,
  type AggregatedOpenPosition,
  type ClosedTradeFlag,
} from '@/lib/finance/tradebook'
import type { CorporateExitType } from '@/types/finance'

type StockView = 'overview' | 'closed' | 'open'

export function InvestmentsPage() {
  const store = useFinanceStore()
  const currency = store.profile.currency
  const [tab, setTab] = useState('stocks')
  const [stockView, setStockView] = useState<StockView>('overview')
  const [open, setOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [symbolFilter, setSymbolFilter] = useState('')
  const [sellYear, setSellYear] = useState<'all' | number>('all')

  const pnl = useMemo(() => {
    const trades = store.trades ?? []
    if (!trades.length) return null
    const overrides: Record<string, number> = {}
    for (const s of store.stocks) {
      const key = (s.ticker || s.name).toUpperCase()
      if (s.currentPrice > 0) overrides[key] = s.currentPrice
    }
    return analyzeTradebook(trades, overrides)
  }, [store.trades, store.stocks])

  const hasLedger = (store.trades?.length ?? 0) > 0

  const filter = symbolFilter.trim().toUpperCase()
  const closedRows = useMemo(() => {
    if (!pnl) return []
    return pnl.closedTrades.filter((r) => {
      if (filter && !r.symbol.toUpperCase().includes(filter)) return false
      if (sellYear !== 'all' && r.sellYear !== sellYear) return false
      return true
    })
  }, [pnl, filter, sellYear])

  const closedByYear = useMemo(() => groupClosedTradesBySellYear(closedRows), [closedRows])
  const closedSymbolCount = useMemo(
    () => (pnl ? aggregateClosedTradesBySymbol(pnl.closedTrades).length : 0),
    [pnl],
  )

  const openRows = useMemo(() => {
    if (!pnl) return []
    if (!filter) return pnl.openLots
    return pnl.openLots.filter((r) => r.symbol.toUpperCase().includes(filter))
  }, [pnl, filter])

  const openPositions = useMemo(() => aggregateOpenLotsBySymbol(openRows), [openRows])
  const openSymbolCount = useMemo(
    () => (pnl ? aggregateOpenLotsBySymbol(pnl.openLots).length : 0),
    [pnl],
  )

  const ledgerSymbols = useMemo(() => {
    if (!pnl) return new Set<string>()
    return new Set(aggregateOpenLotsBySymbol(pnl.openLots).map((p) => p.symbol.toUpperCase()))
  }, [pnl])

  const manualStocks = useMemo(
    () =>
      store.stocks.filter((s) => {
        if (s.source === 'tradebook') return false
        const key = (s.ticker || s.name).toUpperCase()
        if (s.source === 'manual') return true
        // Legacy untagged: keep if not covered by open ledger positions
        return !ledgerSymbols.has(key)
      }),
    [store.stocks, ledgerSymbols],
  )

  const yearOptions = pnl?.bySellYear.map((y) => y.year) ?? []
  const [editStockId, setEditStockId] = useState<string | null>(null)
  const [editMfId, setEditMfId] = useState<string | null>(null)
  const [editOtherId, setEditOtherId] = useState<string | null>(null)
  const [mfTxFundId, setMfTxFundId] = useState<string | null>(null)
  const editingStock = store.stocks.find((s) => s.id === editStockId) ?? null
  const editingMf = store.mutualFunds.find((m) => m.id === editMfId) ?? null
  const editingOther = (store.otherAssets ?? []).find((a) => a.id === editOtherId) ?? null
  const mfTxFund = store.mutualFunds.find((m) => m.id === mfTxFundId) ?? null

  const mfAnalysis = useMemo(
    () => analyzeMfTradebook(store.mfTransactions ?? []),
    [store.mfTransactions],
  )
  const mfTxCountByFund = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of store.mfTransactions ?? []) {
      map.set(t.fundId, (map.get(t.fundId) ?? 0) + 1)
    }
    return map
  }, [store.mfTransactions])

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50">Investments</h1>
          <p className="text-sm text-surface-500">
            Stocks {formatCurrency(stocksValue(store), currency, { compact: true })} · MF{' '}
            {formatCurrency(mfValue(store), currency, { compact: true })} · FD{' '}
            {formatCurrency(fdValue(store), currency, { compact: true })} · Other{' '}
            {formatCurrency(otherAssetsValue(store), currency, { compact: true })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <FileUp className="h-4 w-4" /> Import tradebook
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>

      <Tabs
        tabs={[
          { id: 'stocks', label: 'Stocks & P&L' },
          { id: 'mf', label: 'Mutual funds' },
          { id: 'fd', label: 'Fixed deposits' },
          { id: 'other', label: 'Gold & other' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'stocks' && (
        <div className="space-y-4">
          {hasLedger ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Tabs
                  tabs={[
                    { id: 'overview', label: 'Overview' },
                    { id: 'closed', label: `Buy ↔ Sell (${closedSymbolCount})` },
                    { id: 'open', label: `Open (${openSymbolCount})` },
                  ]}
                  active={stockView}
                  onChange={(id) => setStockView(id as StockView)}
                />
                <div className="flex flex-wrap items-center gap-2">
                  {stockView === 'closed' && yearOptions.length > 0 && (
                    <select
                      value={sellYear === 'all' ? 'all' : String(sellYear)}
                      onChange={(e) =>
                        setSellYear(e.target.value === 'all' ? 'all' : Number(e.target.value))
                      }
                      className="h-10 rounded-xl border border-surface-300 bg-white px-3 text-sm dark:border-surface-600 dark:bg-surface-800"
                    >
                      <option value="all">All financial years</option>
                      {yearOptions.map((y) => (
                        <option key={y} value={y}>
                          {formatFinancialYear(y)}
                        </option>
                      ))}
                    </select>
                  )}
                  {(stockView === 'closed' || stockView === 'open') && (
                    <Input
                      placeholder="Filter symbol…"
                      value={symbolFilter}
                      onChange={(e) => setSymbolFilter(e.target.value)}
                      className="w-40"
                    />
                  )}
                </div>
              </div>

              {stockView === 'overview' && pnl && (
                <OverviewView
                  pnl={pnl}
                  closedSymbolCount={closedSymbolCount}
                  currency={currency}
                  onOpenClosed={() => setStockView('closed')}
                  onOpenOpen={() => setStockView('open')}
                  onSelectYear={(y) => {
                    setSellYear(y)
                    setStockView('closed')
                  }}
                />
              )}

              {stockView === 'closed' && (
                <ClosedTradesByYear
                  groups={closedByYear}
                  currency={currency}
                  onSetExitType={(tradeIds, exitType) => store.setTradeExitType(tradeIds, exitType)}
                />
              )}

              {stockView === 'open' && (
                <OpenLotsTable
                  positions={openPositions}
                  currency={currency}
                  onEditCurrentPrice={(symbol, currentPrice) => {
                    const key = symbol.toUpperCase()
                    const existing = store.stocks.find(
                      (s) => (s.ticker || s.name).toUpperCase() === key,
                    )
                    if (existing) {
                      store.setStocks(
                        store.stocks.map((s) =>
                          s.id === existing.id ? { ...s, currentPrice } : s,
                        ),
                      )
                    } else {
                      const pos = openPositions.find((p) => p.symbol.toUpperCase() === key)
                      if (!pos) return
                      store.setStocks([
                        ...store.stocks,
                        {
                          id: createId(),
                          name: pos.symbol,
                          ticker: pos.symbol,
                          quantity: pos.quantity,
                          buyPrice: pos.avgBuyPrice,
                          currentPrice,
                          source: 'tradebook',
                        },
                      ])
                    }
                  }}
                />
              )}
            </>
          ) : manualStocks.length === 0 ? (
            <EmptyState
              title="No stocks yet"
              description="Import a Zerodha tradebook for full P&L, or add holdings manually."
              actionLabel="Import tradebook"
              onAction={() => setImportOpen(true)}
            />
          ) : null}

          {manualStocks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-surface-600 dark:text-surface-300">
                  Manual holdings
                </p>
                <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
              <SimpleStockList
                items={manualStocks}
                currency={currency}
                onEdit={(id) => setEditStockId(id)}
                onRemove={(id) => store.setStocks(store.stocks.filter((s) => s.id !== id))}
              />
            </div>
          )}
        </div>
      )}

      {tab === 'mf' && (
        <div className="space-y-3">
          {store.mutualFunds.length === 0 ? (
            <EmptyState
              title="No mutual funds yet"
              description="Add a fund, then log buy / SIP / sell lots for capital gains."
              actionLabel="Add"
              onAction={() => setOpen(true)}
            />
          ) : (
            store.mutualFunds.map((m) => {
              const cat = m.fundCategory === 'debt' ? 'debt' : 'equity'
              const lotInvested = mfAnalysis.byFund.find((f) => f.fundId === m.id)?.invested
              const txCount = mfTxCountByFund.get(m.id) ?? 0
              return (
                <Card key={m.id} className="!p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-surface-900 dark:text-surface-50">{m.name}</p>
                        <Badge variant="info">{FUND_CATEGORY_LABELS[cat]}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-surface-400">
                        Invested{' '}
                        {formatCurrency(lotInvested ?? m.investedAmount, currency, {
                          compact: true,
                        })}
                        {m.monthlySip
                          ? ` · SIP ${formatCurrency(m.monthlySip, currency)}/mo`
                          : ''}
                        {txCount ? ` · ${txCount} txn${txCount === 1 ? '' : 's'}` : ' · no lots yet'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold">
                        {formatCurrency(m.currentValue, currency)}
                      </span>
                      <Button variant="outline" size="sm" onClick={() => setMfTxFundId(m.id)}>
                        Lots
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditMfId(m.id)} aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Delete"
                        onClick={() => {
                          store.setMutualFunds(store.mutualFunds.filter((f) => f.id !== m.id))
                          store.setMfTransactions(
                            (store.mfTransactions ?? []).filter((t) => t.fundId !== m.id),
                          )
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-accent-rose" />
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })
          )}
        </div>
      )}
      {tab === 'fd' && (
        <AssetList
          empty="No fixed deposits yet"
          items={store.fixedDeposits.map((f) => ({
            id: f.id,
            title: f.name,
            sub: `${f.interestRate}% · matures ${f.maturityDate}`,
            value: f.principal,
          }))}
          currency={currency}
          onRemove={(id) => store.setFixedDeposits(store.fixedDeposits.filter((f) => f.id !== id))}
          onAdd={() => setOpen(true)}
        />
      )}

      {tab === 'other' && (
        <AssetList
          empty="No gold, silver, or other assets yet"
          items={(store.otherAssets ?? []).map((a) => ({
            id: a.id,
            title: a.name,
            sub: [
              OTHER_ASSET_KIND_LABELS[a.kind],
              `${a.quantity} ${a.unit}`,
              `@ ${formatCurrency(a.currentPrice, currency)}/${a.unit}`,
            ].join(' · '),
            value: a.quantity * a.currentPrice,
          }))}
          currency={currency}
          onEdit={(id) => setEditOtherId(id)}
          onRemove={(id) =>
            store.setOtherAssets((store.otherAssets ?? []).filter((a) => a.id !== id))
          }
          onAdd={() => setOpen(true)}
        />
      )}

      <AddInvestmentModal
        open={open}
        onClose={() => setOpen(false)}
        defaultTab={tab === 'stocks' ? 'stocks' : tab}
      />
      <EditStockModal
        stock={editingStock}
        onClose={() => setEditStockId(null)}
        onSave={(next) => {
          store.setStocks(store.stocks.map((s) => (s.id === next.id ? next : s)))
          setEditStockId(null)
        }}
      />
      <EditMutualFundModal
        fund={editingMf}
        onClose={() => setEditMfId(null)}
        onSave={(next) => {
          store.setMutualFunds(store.mutualFunds.map((m) => (m.id === next.id ? next : m)))
          setEditMfId(null)
        }}
      />
      <MfTransactionsModal
        fund={mfTxFund}
        currency={currency}
        transactions={(store.mfTransactions ?? []).filter((t) => t.fundId === mfTxFundId)}
        onClose={() => setMfTxFundId(null)}
        onChange={(next) => {
          const others = (store.mfTransactions ?? []).filter((t) => t.fundId !== mfTxFundId)
          store.setMfTransactions([...others, ...next])
        }}
      />
      <EditOtherAssetModal
        asset={editingOther}
        onClose={() => setEditOtherId(null)}
        onSave={(next) => {
          store.setOtherAssets(
            (store.otherAssets ?? []).map((a) => (a.id === next.id ? next : a)),
          )
          setEditOtherId(null)
        }}
      />
      <ImportInvestmentsModal open={importOpen} onClose={() => setImportOpen(false)} currency={currency} />
    </div>
  )
}

function OverviewView({
  pnl,
  closedSymbolCount,
  currency,
  onOpenClosed,
  onOpenOpen,
  onSelectYear,
}: {
  pnl: NonNullable<ReturnType<typeof analyzeTradebook>>
  closedSymbolCount: number
  currency: 'INR' | 'USD' | 'EUR' | 'GBP'
  onOpenClosed: () => void
  onOpenOpen: () => void
  onSelectYear: (year: number) => void
}) {
  const net = pnl.realizedPnl + pnl.unrealizedPnl
  const recentClosed = useMemo(
    () => aggregateClosedTradesBySymbol(pnl.closedTrades).slice(0, 6),
    [pnl.closedTrades],
  )
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Net P&L"
          value={formatCurrency(net, currency, { compact: true })}
          trend={net >= 0 ? 'up' : 'down'}
          sub="Realized + unrealized"
        />
        <StatCard
          label="Realized P&L"
          value={formatCurrency(pnl.realizedPnl, currency, { compact: true })}
          trend={pnl.realizedPnl >= 0 ? 'up' : 'down'}
          sub={`${closedSymbolCount} symbol(s) closed`}
        />
        <StatCard
          label="Unrealized P&L"
          value={formatCurrency(pnl.unrealizedPnl, currency, { compact: true })}
          trend={pnl.unrealizedPnl >= 0 ? 'up' : 'down'}
          sub={`${pnl.bySymbol.filter((s) => s.openQty > 0).length} open · ${pnl.openLots.length} lot(s)`}
        />
        <StatCard
          label="Open invested"
          value={formatCurrency(pnl.totalInvested, currency, { compact: true })}
          sub="Cost of open lots (qty × buy)"
        />
        <StatCard
          label="Open market value"
          value={formatCurrency(pnl.marketValue, currency, { compact: true })}
          sub="Open lots × last trade price"
        />
      </div>

      {pnl.warnings[0] && (
        <p className="text-xs text-amber-700 dark:text-amber-300">{pnl.warnings[0]}</p>
      )}

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-surface-900 dark:text-surface-50">FY-wise realized P&L</h3>
            <p className="text-xs text-surface-400">
              Indian FY (Apr–Mar) · attributed to the year of the sell
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onOpenClosed}>
            All buy↔sell →
          </Button>
        </div>
        {pnl.bySellYear.length === 0 ? (
          <p className="py-6 text-center text-sm text-surface-400">No closed trades yet</p>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-surface-200 text-xs text-surface-400 dark:border-surface-700">
                  <th className="pb-2 pr-3 font-medium">Financial year</th>
                  <th className="pb-2 pr-3 font-medium">Symbols</th>
                  <th className="pb-2 pr-3 font-medium">Buy value</th>
                  <th className="pb-2 pr-3 font-medium">Sell value</th>
                  <th className="pb-2 pr-3 font-medium">W / L</th>
                  <th className="pb-2 font-medium">Realized P&L</th>
                </tr>
              </thead>
              <tbody>
                {pnl.bySellYear.map((y) => (
                  <tr
                    key={y.year}
                    className="cursor-pointer border-b border-surface-100 hover:bg-surface-50 dark:border-surface-800 dark:hover:bg-surface-800/40"
                    onClick={() => onSelectYear(y.year)}
                  >
                    <td className="py-2.5 pr-3 font-semibold text-brand-700 dark:text-brand-300">
                      {y.label}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs">{y.trades}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs">
                      {formatCurrency(y.buyValue, currency, { compact: true })}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs">
                      {formatCurrency(y.sellValue, currency, { compact: true })}
                    </td>
                    <td className="py-2.5 pr-3 text-xs">
                      <span className="text-brand-600">{y.wins}W</span>
                      {' / '}
                      <span className="text-accent-rose">{y.losses}L</span>
                    </td>
                    <td className={cn('py-2.5 font-mono text-xs font-semibold', moneyClass(y.realizedPnl))}>
                      {fmtSigned(y.realizedPnl, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-surface-900 dark:text-surface-50">By symbol</h3>
            <Button variant="ghost" size="sm" onClick={onOpenOpen}>
              Open lots →
            </Button>
          </div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="border-b border-surface-200 text-xs text-surface-400 dark:border-surface-700">
                  <th className="pb-2 pr-2 font-medium">Symbol</th>
                  <th className="pb-2 pr-2 font-medium">Open qty</th>
                  <th className="pb-2 pr-2 font-medium">Realized</th>
                  <th className="pb-2 font-medium">Unrealized</th>
                </tr>
              </thead>
              <tbody>
                {pnl.bySymbol
                  .filter((r) => r.openQty > 0 || r.realizedPnl !== 0)
                  .map((r) => (
                    <tr key={r.symbol} className="border-b border-surface-100 dark:border-surface-800">
                      <td className="py-2 pr-2 font-medium">{r.symbol}</td>
                      <td className="py-2 pr-2 font-mono text-xs">{r.openQty || '—'}</td>
                      <td className={cn('py-2 pr-2 font-mono text-xs', moneyClass(r.realizedPnl))}>
                        {fmtSigned(r.realizedPnl, currency)}
                      </td>
                      <td className={cn('py-2 font-mono text-xs', moneyClass(r.unrealizedPnl))}>
                        {r.openQty ? fmtSigned(r.unrealizedPnl, currency) : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-surface-900 dark:text-surface-50">Recent buy ↔ sell</h3>
            <Button variant="ghost" size="sm" onClick={onOpenClosed}>
              View all →
            </Button>
          </div>
          {recentClosed.length === 0 ? (
            <p className="py-6 text-center text-sm text-surface-400">No closed trades yet</p>
          ) : (
            <div className="space-y-2">
              {recentClosed.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {r.symbol}{' '}
                      <ExitFlagBadge flag={r.flag} />{' '}
                      <span className="text-xs font-normal text-surface-400">
                        {formatFinancialYear(r.sellYear)}
                        {r.fillCount > 1 ? ` · ${r.fillCount} fills` : ''}
                      </span>
                    </p>
                    <p className="text-xs text-surface-400">
                      Avg buy {formatCurrency(r.avgBuyPrice, currency)} → Avg sell{' '}
                      {formatCurrency(r.avgSellPrice, currency)} · {r.quantity} qty
                    </p>
                  </div>
                  <span className={cn('shrink-0 font-mono text-xs font-semibold', moneyClass(r.pnl))}>
                    {fmtSigned(r.pnl, currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function ExitFlagBadge({ flag }: { flag?: ClosedTradeFlag | null }) {
  const label = corporateExitLabel(flag)
  if (!label || !flag) return null
  const variant =
    flag === 'ipo'
      ? 'info'
      : flag === 'rights' || flag === 'split'
        ? 'warning'
        : 'success'
  return (
    <Badge variant={variant} className="!px-1.5 !py-0 text-[10px]">
      {label}
    </Badge>
  )
}

function ClosedTradesByYear({
  groups,
  currency,
  onSetExitType,
}: {
  groups: ReturnType<typeof groupClosedTradesBySellYear>
  currency: 'INR' | 'USD' | 'EUR' | 'GBP'
  onSetExitType: (tradeIds: string[], exitType: CorporateExitType | null) => void
}) {
  const [selected, setSelected] = useState<AggregatedClosedTrade | null>(null)

  if (groups.length === 0) {
    return (
      <EmptyState
        title="No buy↔sell matches"
        description="Closed lots appear here with buy and sell together, grouped by the Indian FY of the sell (Apr–Mar). Multiple fills of the same stock are aggregated."
      />
    )
  }

  const selectedExitValue = (() => {
    if (!selected) return ''
    if (selected.flag && CORPORATE_EXIT_OPTIONS.some((o) => o.value === selected.flag)) {
      return selected.flag
    }
    return ''
  })()

  return (
    <>
      <div className="space-y-4">
        {groups.map(({ year, summary, trades }) => (
          <Card key={year} className="!p-0 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-200 bg-surface-50 px-4 py-3 dark:border-surface-700 dark:bg-surface-800/50">
              <div>
                <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-50">
                  {summary.label}
                </h3>
                <p className="text-xs text-surface-400">
                  {summary.trades} symbol(s) · {summary.wins}W / {summary.losses}L · sold in{' '}
                  {summary.label}
                </p>
              </div>
              <div className="flex flex-wrap gap-4 text-right text-xs">
                <div>
                  <p className="text-surface-400">Buy value</p>
                  <p className="font-mono font-medium">
                    {formatCurrency(summary.buyValue, currency, { compact: true })}
                  </p>
                </div>
                <div>
                  <p className="text-surface-400">Sell value</p>
                  <p className="font-mono font-medium">
                    {formatCurrency(summary.sellValue, currency, { compact: true })}
                  </p>
                </div>
                <div>
                  <p className="text-surface-400">Realized P&L</p>
                  <p className={cn('font-mono font-semibold', moneyClass(summary.realizedPnl))}>
                    {fmtSigned(summary.realizedPnl, currency)}
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="text-xs text-surface-500">
                    <th className="px-4 py-2.5 font-medium">Symbol</th>
                    <th className="px-3 py-2.5 font-medium">Fills</th>
                    <th className="px-3 py-2.5 font-medium">Buy period</th>
                    <th className="px-3 py-2.5 font-medium">Sell period</th>
                    <th className="px-3 py-2.5 font-medium">Qty</th>
                    <th className="px-3 py-2.5 font-medium">Avg buy</th>
                    <th className="px-3 py-2.5 font-medium">Avg sell</th>
                    <th className="px-3 py-2.5 font-medium">Buy value</th>
                    <th className="px-3 py-2.5 font-medium">Sell value</th>
                    <th className="px-3 py-2.5 font-medium">Days</th>
                    <th className="px-4 py-2.5 font-medium">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((r) => (
                    <tr
                      key={r.id}
                      className="cursor-pointer border-t border-surface-100 hover:bg-surface-50 dark:border-surface-800 dark:hover:bg-surface-800/40"
                      onClick={() => setSelected(r)}
                    >
                      <td className="px-4 py-2.5 font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          {r.symbol}
                          <ExitFlagBadge flag={r.flag} />
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">{r.fillCount}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-surface-600 dark:text-surface-300">
                        {r.firstBuyDate === r.lastBuyDate
                          ? r.firstBuyDate
                          : `${r.firstBuyDate} → ${r.lastBuyDate}`}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-surface-600 dark:text-surface-300">
                        {r.firstSellDate === r.lastSellDate
                          ? r.firstSellDate
                          : `${r.firstSellDate} → ${r.lastSellDate}`}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">{r.quantity}</td>
                      <td className="px-3 py-2.5 font-mono text-xs">
                        {formatCurrency(r.avgBuyPrice, currency)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">
                        {formatCurrency(r.avgSellPrice, currency)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">
                        {formatCurrency(r.buyValue, currency, { compact: true })}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">
                        {formatCurrency(r.sellValue, currency, { compact: true })}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">{r.holdingDays}</td>
                      <td className="px-4 py-2.5">
                        <div className={cn('font-mono text-xs font-semibold', moneyClass(r.pnl))}>
                          {fmtSigned(r.pnl, currency)}
                        </div>
                        <div className={cn('text-[10px]', moneyClass(r.pnl))}>
                          {r.pnlPercent >= 0 ? '+' : ''}
                          {r.pnlPercent}%
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={
          selected
            ? `${selected.symbol}${corporateExitLabel(selected.flag) ? ` · ${corporateExitLabel(selected.flag)}` : ''} · fills`
            : 'Fills'
        }
        className="sm:max-w-2xl"
      >
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs text-surface-400">Qty</p>
                <p className="font-mono font-medium">{selected.quantity}</p>
              </div>
              <div>
                <p className="text-xs text-surface-400">Avg buy</p>
                <p className="font-mono font-medium">
                  {formatCurrency(selected.avgBuyPrice, currency)}
                </p>
              </div>
              <div>
                <p className="text-xs text-surface-400">Avg sell</p>
                <p className="font-mono font-medium">
                  {formatCurrency(selected.avgSellPrice, currency)}
                </p>
              </div>
              <div>
                <p className="text-xs text-surface-400">P&L</p>
                <p className={cn('font-mono font-semibold', moneyClass(selected.pnl))}>
                  {fmtSigned(selected.pnl, currency)}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-surface-200 bg-surface-50/80 p-3 dark:border-surface-700 dark:bg-surface-800/40">
              <label className="mb-1.5 block text-xs font-medium text-surface-500">
                Mark exit as corporate action
              </label>
              <select
                className="h-10 w-full rounded-xl border border-surface-300 bg-white px-3 text-sm dark:border-surface-600 dark:bg-surface-800"
                value={selectedExitValue}
                disabled={selected.sellTradeIds.length === 0}
                onChange={(e) => {
                  const value = e.target.value
                  const exitType = (value || null) as CorporateExitType | null
                  onSetExitType(selected.sellTradeIds, exitType)
                  setSelected({
                    ...selected,
                    flag: exitType ?? (selected.flag === 'ipo' || selected.flag === 'rights' ? selected.flag : undefined),
                    fills: selected.fills.map((f) => ({
                      ...f,
                      flag: exitType ?? (f.flag === 'ipo' || f.flag === 'rights' ? f.flag : undefined),
                    })),
                  })
                }}
              >
                <option value="">Market sell (default)</option>
                {CORPORATE_EXIT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] text-surface-400">
                {selected.sellTradeIds.length === 0
                  ? 'No linked sell trade ids — cannot tag this exit.'
                  : 'Applies to all sell fills for this symbol in the selection. Survives tradebook re-import.'}
              </p>
            </div>

            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="text-xs text-surface-500">
                    <th className="pb-2 pr-2 font-medium">Buy</th>
                    <th className="pb-2 pr-2 font-medium">Sell</th>
                    <th className="pb-2 pr-2 font-medium">Qty</th>
                    <th className="pb-2 pr-2 font-medium">Buy price</th>
                    <th className="pb-2 pr-2 font-medium">Sell price</th>
                    <th className="pb-2 pr-2 font-medium">Days</th>
                    <th className="pb-2 pr-2 font-medium">Exit</th>
                    <th className="pb-2 font-medium">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.fills.map((f) => (
                    <tr key={f.id} className="border-t border-surface-100 dark:border-surface-800">
                      <td className="py-2 pr-2 font-mono text-xs">{f.buyDate}</td>
                      <td className="py-2 pr-2 font-mono text-xs">{f.sellDate}</td>
                      <td className="py-2 pr-2 font-mono text-xs">{f.quantity}</td>
                      <td className="py-2 pr-2 font-mono text-xs">
                        {formatCurrency(f.buyPrice, currency)}
                      </td>
                      <td className="py-2 pr-2 font-mono text-xs">
                        {formatCurrency(f.sellPrice, currency)}
                      </td>
                      <td className="py-2 pr-2 font-mono text-xs">{f.holdingDays}</td>
                      <td className="py-2 pr-2">
                        <ExitFlagBadge flag={f.flag} />
                      </td>
                      <td className={cn('py-2 font-mono text-xs font-semibold', moneyClass(f.pnl))}>
                        {fmtSigned(f.pnl, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

function OpenLotsTable({
  positions,
  currency,
  onEditCurrentPrice,
}: {
  positions: AggregatedOpenPosition[]
  currency: 'INR' | 'USD' | 'EUR' | 'GBP'
  onEditCurrentPrice: (symbol: string, currentPrice: number) => void
}) {
  const [selected, setSelected] = useState<AggregatedOpenPosition | null>(null)
  const [ltpDraft, setLtpDraft] = useState('')

  if (positions.length === 0) {
    return <EmptyState title="No open positions" description="Buy lots that haven’t been sold yet will appear here." />
  }

  return (
    <>
      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-surface-50 dark:bg-surface-800/60">
              <tr className="text-xs text-surface-500">
                <th className="px-4 py-3 font-medium">Symbol</th>
                <th className="px-3 py-3 font-medium">Buys</th>
                <th className="px-3 py-3 font-medium">Qty</th>
                <th className="px-3 py-3 font-medium">Avg buy</th>
                <th className="px-3 py-3 font-medium">Current</th>
                <th className="px-3 py-3 font-medium">Invested</th>
                <th className="px-3 py-3 font-medium">Market</th>
                <th className="px-4 py-3 font-medium">Unrealized</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((r) => (
                <tr
                  key={r.symbol}
                  className="cursor-pointer border-t border-surface-100 hover:bg-surface-50 dark:border-surface-800 dark:hover:bg-surface-800/40"
                  onClick={() => {
                    setSelected(r)
                    setLtpDraft(String(r.currentPrice))
                  }}
                >
                  <td className="px-4 py-2.5 font-medium">{r.symbol}</td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-xs">{r.lotCount}</span>
                    {r.lotCount > 1 && (
                      <span className="ml-1 text-[10px] text-surface-400">lots</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs">{r.quantity}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{formatCurrency(r.avgBuyPrice, currency)}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{formatCurrency(r.currentPrice, currency)}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{formatCurrency(r.invested, currency)}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{formatCurrency(r.marketValue, currency)}</td>
                  <td className="px-4 py-2.5">
                    <div className={cn('font-mono text-xs font-semibold', moneyClass(r.unrealizedPnl))}>
                      {fmtSigned(r.unrealizedPnl, currency)}
                    </div>
                    <div className={cn('text-[10px]', moneyClass(r.unrealizedPnl))}>
                      {r.unrealizedPercent >= 0 ? '+' : ''}
                      {r.unrealizedPercent}%
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-surface-100 px-4 py-2 text-[11px] text-surface-400 dark:border-surface-800">
          Click a symbol to see lots and update current price
        </p>
      </Card>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.symbol} · open buys` : 'Open buys'}
        className="sm:max-w-2xl"
        footer={
          selected ? (
            <>
              <Button variant="ghost" onClick={() => setSelected(null)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  const n = Number(ltpDraft)
                  if (!Number.isFinite(n) || n < 0) return
                  onEditCurrentPrice(selected.symbol, n)
                  setSelected(null)
                }}
              >
                Save current price
              </Button>
            </>
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-4">
            <Input
              label="Current price (LTP)"
              type="number"
              value={ltpDraft}
              onChange={(e) => setLtpDraft(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <p className="text-xs text-surface-400">Qty</p>
                <p className="font-mono text-sm font-medium">{selected.quantity}</p>
              </div>
              <div>
                <p className="text-xs text-surface-400">Avg buy</p>
                <p className="font-mono text-sm font-medium">
                  {formatCurrency(selected.avgBuyPrice, currency)}
                </p>
              </div>
              <div>
                <p className="text-xs text-surface-400">Invested</p>
                <p className="font-mono text-sm font-medium">
                  {formatCurrency(selected.invested, currency)}
                </p>
              </div>
              <div>
                <p className="text-xs text-surface-400">Lots</p>
                <p className="font-mono text-sm font-medium">{selected.lotCount}</p>
              </div>
            </div>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="text-xs text-surface-500">
                    <th className="pb-2 pr-2 font-medium">Buy date</th>
                    <th className="pb-2 pr-2 font-medium">Qty</th>
                    <th className="pb-2 pr-2 font-medium">Buy price</th>
                    <th className="pb-2 pr-2 font-medium">Invested</th>
                    <th className="pb-2 font-medium">Unrealized</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.lots.map((lot) => (
                    <tr key={lot.id} className="border-t border-surface-100 dark:border-surface-800">
                      <td className="py-2 pr-2 font-mono text-xs">{lot.buyDate}</td>
                      <td className="py-2 pr-2 font-mono text-xs">{lot.quantity}</td>
                      <td className="py-2 pr-2 font-mono text-xs">
                        {formatCurrency(lot.buyPrice, currency)}
                      </td>
                      <td className="py-2 pr-2 font-mono text-xs">
                        {formatCurrency(lot.invested, currency)}
                      </td>
                      <td className={cn('py-2 font-mono text-xs font-semibold', moneyClass(lot.unrealizedPnl))}>
                        {fmtSigned(lot.unrealizedPnl, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

function moneyClass(n: number) {
  if (n > 0) return 'text-brand-600 dark:text-brand-400'
  if (n < 0) return 'text-accent-rose'
  return 'text-surface-500'
}

function fmtSigned(n: number, currency: 'INR' | 'USD' | 'EUR' | 'GBP') {
  const s = formatCurrency(Math.abs(n), currency, { compact: true })
  if (n > 0) return `+${s}`
  if (n < 0) return `-${s}`
  return s
}

function SimpleStockList({
  items,
  currency,
  onEdit,
  onRemove,
}: {
  items: { id: string; name: string; ticker?: string; quantity: number; buyPrice: number; currentPrice: number }[]
  currency: 'INR' | 'USD' | 'EUR' | 'GBP'
  onEdit: (id: string) => void
  onRemove: (id: string) => void
}) {
  return (
    <div className="space-y-2">
      {items.map((s) => {
        const invested = s.quantity * s.buyPrice
        const market = s.quantity * s.currentPrice
        const pnl = market - invested
        return (
          <Card key={s.id} className="flex items-center justify-between !p-4">
            <div>
              <p className="font-medium">{s.ticker ? `${s.name} (${s.ticker})` : s.name}</p>
              <p className="text-xs text-surface-400">
                {s.quantity} × buy {formatCurrency(s.buyPrice, currency)} · now{' '}
                {formatCurrency(s.currentPrice, currency)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="font-mono text-sm font-semibold">{formatCurrency(market, currency)}</p>
                <p className={cn('font-mono text-[11px]', moneyClass(pnl))}>{fmtSigned(pnl, currency)}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onEdit(s.id)} aria-label="Edit stock">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onRemove(s.id)} aria-label="Delete stock">
                <Trash2 className="h-4 w-4 text-accent-rose" />
              </Button>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

function AssetList({
  empty,
  items,
  currency,
  onEdit,
  onRemove,
  onAdd,
}: {
  empty: string
  items: { id: string; title: string; sub: string; value: number }[]
  currency: 'INR' | 'USD' | 'EUR' | 'GBP'
  onEdit?: (id: string) => void
  onRemove: (id: string) => void
  onAdd: () => void
}) {
  if (items.length === 0) {
    return <EmptyState title={empty} actionLabel="Add" onAction={onAdd} />
  }
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <Card key={item.id} className="flex items-center justify-between !p-4">
          <div>
            <p className="font-medium text-surface-900 dark:text-surface-50">{item.title}</p>
            <p className="text-xs text-surface-400">{item.sub}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold">{formatCurrency(item.value, currency)}</span>
            {onEdit && (
              <Button variant="ghost" size="sm" onClick={() => onEdit(item.id)} aria-label="Edit">
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => onRemove(item.id)} aria-label="Delete">
              <Trash2 className="h-4 w-4 text-accent-rose" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  )
}

function AddInvestmentModal({
  open,
  onClose,
  defaultTab,
}: {
  open: boolean
  onClose: () => void
  defaultTab: string
}) {
  const store = useFinanceStore()
  const [type, setType] = useState(defaultTab === 'stocks' ? 'stocks' : defaultTab)
  const [form, setForm] = useState({
    name: '',
    ticker: '',
    quantity: '1',
    price: '',
    invested: '',
    current: '',
    sip: '',
    fundCategory: 'equity' as FundCategory,
    rate: '7',
    start: new Date().toISOString().slice(0, 10),
    maturity: new Date().toISOString().slice(0, 10),
    kind: 'gold' as OtherAssetKind,
    unit: 'g',
  })

  useEffect(() => {
    setType(defaultTab === 'stocks' ? 'stocks' : defaultTab)
  }, [defaultTab, open])

  const save = () => {
    if (type === 'stocks' && form.name && form.price) {
      const buy = Number(form.price)
      const current = Number(form.current || form.price)
      store.setStocks([
        ...store.stocks,
        {
          id: createId(),
          name: form.name,
          ticker: form.ticker || undefined,
          quantity: Number(form.quantity) || 1,
          buyPrice: buy,
          currentPrice: Number.isFinite(current) ? current : buy,
          source: 'manual',
        },
      ])
    } else if (type === 'mf' && form.name) {
      const v = Number(form.current || form.invested) || 0
      store.setMutualFunds([
        ...store.mutualFunds,
        {
          id: createId(),
          name: form.name,
          investedAmount: Number(form.invested) || v,
          currentValue: v,
          monthlySip: Number(form.sip) || 0,
          fundCategory: form.fundCategory,
        },
      ])
    } else if (type === 'fd' && form.name && form.invested) {
      store.setFixedDeposits([
        ...store.fixedDeposits,
        {
          id: createId(),
          name: form.name,
          principal: Number(form.invested),
          interestRate: Number(form.rate) || 0,
          startDate: form.start,
          maturityDate: form.maturity,
        },
      ])
    } else if (type === 'other' && form.name && form.price) {
      const buy = Number(form.price)
      const current = Number(form.current || form.price)
      const quantity = Number(form.quantity) || 0
      if (quantity <= 0) return
      store.setOtherAssets([
        ...(store.otherAssets ?? []),
        {
          id: createId(),
          name: form.name,
          kind: form.kind,
          quantity,
          unit: form.unit.trim() || defaultUnitForKind(form.kind),
          buyPrice: buy,
          currentPrice: Number.isFinite(current) ? current : buy,
        },
      ])
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add investment"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Tabs
          tabs={[
            { id: 'stocks', label: 'Stock' },
            { id: 'mf', label: 'MF' },
            { id: 'fd', label: 'FD' },
            { id: 'other', label: 'Gold & other' },
          ]}
          active={type}
          onChange={setType}
        />
        {type === 'other' && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">
              Type
            </label>
            <select
              value={form.kind}
              onChange={(e) => {
                const kind = e.target.value as OtherAssetKind
                setForm({
                  ...form,
                  kind,
                  unit: defaultUnitForKind(kind),
                  name: form.name || OTHER_ASSET_KIND_LABELS[kind],
                })
              }}
              className="h-10 w-full rounded-xl border border-surface-300 bg-white px-3 text-sm dark:border-surface-600 dark:bg-surface-800"
            >
              {OTHER_ASSET_KIND_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {OTHER_ASSET_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        )}
        <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        {type === 'stocks' && (
          <>
            <Input label="Ticker" value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Quantity" type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              <Input label="Buy price" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <Input
              label="Current price"
              type="number"
              value={form.current}
              onChange={(e) => setForm({ ...form, current: e.target.value })}
              placeholder="Defaults to buy price"
            />
          </>
        )}
        {type === 'mf' && (
          <>
            <Select
              label="Category"
              value={form.fundCategory}
              onChange={(e) =>
                setForm({ ...form, fundCategory: e.target.value as FundCategory })
              }
              options={FUND_CATEGORY_OPTIONS.map((c) => ({
                value: c,
                label: FUND_CATEGORY_LABELS[c],
              }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Invested" type="number" value={form.invested} onChange={(e) => setForm({ ...form, invested: e.target.value })} />
              <Input label="Current value" type="number" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} />
            </div>
            <Input label="Monthly SIP" type="number" value={form.sip} onChange={(e) => setForm({ ...form, sip: e.target.value })} />
          </>
        )}
        {type === 'fd' && (
          <>
            <Input label="Principal" type="number" value={form.invested} onChange={(e) => setForm({ ...form, invested: e.target.value })} />
            <Input label="Interest %" type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Start" type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
              <Input label="Maturity" type="date" value={form.maturity} onChange={(e) => setForm({ ...form, maturity: e.target.value })} />
            </div>
          </>
        )}
        {type === 'other' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Quantity"
                type="number"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
              <Input
                label="Unit"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                placeholder="g"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={`Buy price / ${form.unit || 'unit'}`}
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
              <Input
                label={`Current price / ${form.unit || 'unit'}`}
                type="number"
                value={form.current}
                onChange={(e) => setForm({ ...form, current: e.target.value })}
                placeholder="Defaults to buy price"
              />
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

function EditStockModal({
  stock,
  onClose,
  onSave,
}: {
  stock: Stock | null
  onClose: () => void
  onSave: (next: Stock) => void
}) {
  const [form, setForm] = useState({ name: '', ticker: '', quantity: '', buyPrice: '', currentPrice: '' })

  // Reset draft when a different stock is opened
  useEffect(() => {
    if (!stock) return
    setForm({
      name: stock.name,
      ticker: stock.ticker ?? '',
      quantity: String(stock.quantity),
      buyPrice: String(stock.buyPrice),
      currentPrice: String(stock.currentPrice),
    })
  }, [stock])

  const save = () => {
    if (!stock || !form.name) return
    const quantity = Number(form.quantity)
    const buyPrice = Number(form.buyPrice)
    const currentPrice = Number(form.currentPrice)
    if (![quantity, buyPrice, currentPrice].every((n) => Number.isFinite(n) && n >= 0)) return
    onSave({
      ...stock,
      name: form.name,
      ticker: form.ticker || undefined,
      quantity,
      buyPrice,
      currentPrice,
      source: stock.source ?? 'manual',
    })
  }

  return (
    <Modal
      open={!!stock}
      onClose={onClose}
      title="Edit stock"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input label="Ticker" value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} />
        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Quantity"
            type="number"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          />
          <Input
            label="Buy price"
            type="number"
            value={form.buyPrice}
            onChange={(e) => setForm({ ...form, buyPrice: e.target.value })}
          />
          <Input
            label="Current price"
            type="number"
            value={form.currentPrice}
            onChange={(e) => setForm({ ...form, currentPrice: e.target.value })}
          />
        </div>
      </div>
    </Modal>
  )
}

function EditMutualFundModal({
  fund,
  onClose,
  onSave,
}: {
  fund: MutualFund | null
  onClose: () => void
  onSave: (next: MutualFund) => void
}) {
  const [form, setForm] = useState({
    name: '',
    invested: '',
    current: '',
    sip: '',
    fundCategory: 'equity' as FundCategory,
  })
  useEffect(() => {
    if (!fund) return
    setForm({
      name: fund.name,
      invested: String(fund.investedAmount),
      current: String(fund.currentValue),
      sip: String(fund.monthlySip),
      fundCategory: fund.fundCategory === 'debt' ? 'debt' : 'equity',
    })
  }, [fund])

  const save = () => {
    if (!fund || !form.name) return
    const investedAmount = Number(form.invested)
    const currentValue = Number(form.current)
    const monthlySip = Number(form.sip) || 0
    if (![investedAmount, currentValue, monthlySip].every((n) => Number.isFinite(n) && n >= 0)) return
    onSave({
      ...fund,
      name: form.name,
      investedAmount,
      currentValue,
      monthlySip,
      fundCategory: form.fundCategory,
    })
  }

  return (
    <Modal
      open={!!fund}
      onClose={onClose}
      title="Edit mutual fund"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Select
          label="Category"
          value={form.fundCategory}
          onChange={(e) => setForm({ ...form, fundCategory: e.target.value as FundCategory })}
          options={FUND_CATEGORY_OPTIONS.map((c) => ({
            value: c,
            label: FUND_CATEGORY_LABELS[c],
          }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Invested"
            type="number"
            value={form.invested}
            onChange={(e) => setForm({ ...form, invested: e.target.value })}
          />
          <Input
            label="Current value"
            type="number"
            value={form.current}
            onChange={(e) => setForm({ ...form, current: e.target.value })}
          />
        </div>
        <Input
          label="Monthly SIP"
          type="number"
          value={form.sip}
          onChange={(e) => setForm({ ...form, sip: e.target.value })}
        />
      </div>
    </Modal>
  )
}

function MfTransactionsModal({
  fund,
  currency,
  transactions,
  onClose,
  onChange,
}: {
  fund: MutualFund | null
  currency: 'INR' | 'USD' | 'EUR' | 'GBP'
  transactions: MfTransaction[]
  onClose: () => void
  onChange: (next: MfTransaction[]) => void
}) {
  const [form, setForm] = useState({
    type: 'buy' as MfTransactionType,
    date: new Date().toISOString().slice(0, 10),
    units: '',
    nav: '',
  })

  useEffect(() => {
    if (!fund) return
    setForm({
      type: 'buy',
      date: new Date().toISOString().slice(0, 10),
      units: '',
      nav: '',
    })
  }, [fund])

  const add = () => {
    if (!fund) return
    const units = Number(form.units)
    const nav = Number(form.nav)
    if (!form.date || !(units > 0) || !(nav > 0)) return
    const next: MfTransaction = {
      id: createId(),
      fundId: fund.id,
      date: form.date,
      type: form.type,
      units,
      nav,
      amount: Math.round(units * nav * 100) / 100,
    }
    onChange([...transactions, next])
    setForm({ ...form, units: '', nav: '' })
  }

  const remove = (id: string) => {
    onChange(transactions.filter((t) => t.id !== id))
  }

  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <Modal
      open={!!fund}
      onClose={onClose}
      title={fund ? `Lots · ${fund.name}` : 'Lots'}
      footer={
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-surface-500">
          Log buy / SIP / sell units for STCG–LTCG. CSV import can fill the same ledger later.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Type"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as MfTransactionType })}
            options={[
              { value: 'buy', label: 'Buy' },
              { value: 'sip', label: 'SIP' },
              { value: 'sell', label: 'Sell' },
            ]}
          />
          <Input
            label="Date"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <Input
            label="Units"
            type="number"
            value={form.units}
            onChange={(e) => setForm({ ...form, units: e.target.value })}
          />
          <Input
            label="NAV"
            type="number"
            value={form.nav}
            onChange={(e) => setForm({ ...form, nav: e.target.value })}
          />
        </div>
        <Button onClick={add} className="w-full sm:w-auto">
          <Plus className="h-4 w-4" /> Add transaction
        </Button>

        {sorted.length === 0 ? (
          <p className="text-sm text-surface-500">No transactions yet.</p>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {sorted.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-surface-200 px-3 py-2 text-sm dark:border-surface-700"
              >
                <div>
                  <p className="font-medium capitalize text-surface-800 dark:text-surface-100">
                    {t.type} · {t.date}
                  </p>
                  <p className="text-xs text-surface-400">
                    {t.units} u @ {formatCurrency(t.nav, currency)}
                    {t.amount != null ? ` · ${formatCurrency(t.amount, currency)}` : ''}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => remove(t.id)} aria-label="Delete">
                  <Trash2 className="h-4 w-4 text-accent-rose" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}

function EditOtherAssetModal({
  asset,
  onClose,
  onSave,
}: {
  asset: OtherAsset | null
  onClose: () => void
  onSave: (next: OtherAsset) => void
}) {
  const [form, setForm] = useState({
    name: '',
    kind: 'gold' as OtherAssetKind,
    quantity: '',
    unit: 'g',
    buyPrice: '',
    currentPrice: '',
  })

  useEffect(() => {
    if (!asset) return
    setForm({
      name: asset.name,
      kind: asset.kind,
      quantity: String(asset.quantity),
      unit: asset.unit,
      buyPrice: String(asset.buyPrice),
      currentPrice: String(asset.currentPrice),
    })
  }, [asset])

  const save = () => {
    if (!asset || !form.name) return
    const quantity = Number(form.quantity)
    const buyPrice = Number(form.buyPrice)
    const currentPrice = Number(form.currentPrice)
    if (![quantity, buyPrice, currentPrice].every((n) => Number.isFinite(n) && n >= 0)) return
    onSave({
      ...asset,
      name: form.name,
      kind: form.kind,
      quantity,
      unit: form.unit.trim() || defaultUnitForKind(form.kind),
      buyPrice,
      currentPrice,
    })
  }

  return (
    <Modal
      open={!!asset}
      onClose={onClose}
      title="Edit asset"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">
            Type
          </label>
          <select
            value={form.kind}
            onChange={(e) => {
              const kind = e.target.value as OtherAssetKind
              setForm({ ...form, kind, unit: form.unit || defaultUnitForKind(kind) })
            }}
            className="h-10 w-full rounded-xl border border-surface-300 bg-white px-3 text-sm dark:border-surface-600 dark:bg-surface-800"
          >
            {OTHER_ASSET_KIND_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {OTHER_ASSET_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Quantity"
            type="number"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          />
          <Input
            label="Unit"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={`Buy price / ${form.unit || 'unit'}`}
            type="number"
            value={form.buyPrice}
            onChange={(e) => setForm({ ...form, buyPrice: e.target.value })}
          />
          <Input
            label={`Current price / ${form.unit || 'unit'}`}
            type="number"
            value={form.currentPrice}
            onChange={(e) => setForm({ ...form, currentPrice: e.target.value })}
          />
        </div>
      </div>
    </Modal>
  )
}
