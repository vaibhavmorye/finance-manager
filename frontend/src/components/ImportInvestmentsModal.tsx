import { useRef, useState } from 'react'
import { FileSpreadsheet, Upload, AlertTriangle, CheckCircle2, Layers } from 'lucide-react'
import { Button, Modal, Badge, StatCard } from '@/components/ui'
import { formatCurrency } from '@/lib/utils'
import { useFinanceStore } from '@/store/financeStore'
import { readSpreadsheetFile, NumbersFormatError } from '@/lib/import/spreadsheet'
import {
  parseInvestmentsWorkbook,
  mergeByTickerOrName,
  type ImportResult,
} from '@/lib/import/investments'
import { analyzeTradebook, mergeTrades } from '@/lib/finance/tradebook'
import type { Currency, Trade } from '@/types/finance'

interface Props {
  open: boolean
  onClose: () => void
  currency: Currency
}

export function ImportInvestmentsModal({ open, onClose, currency }: Props) {
  const store = useFinanceStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [pendingTrades, setPendingTrades] = useState<Trade[]>([])
  const [filesLoaded, setFilesLoaded] = useState<string[]>([])
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')

  const reset = () => {
    setError('')
    setResult(null)
    setPendingTrades([])
    setFilesLoaded([])
    setBusy(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const onFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return
    setBusy(true)
    setError('')
    try {
      let combinedTrades = [...pendingTrades]
      let lastNonTrade: ImportResult | null = null
      const names = [...filesLoaded]

      for (const file of Array.from(fileList)) {
        const wb = await readSpreadsheetFile(file)
        const parsed = parseInvestmentsWorkbook(wb, file.name)
        if (parsed.trades.length > 0 || parsed.format === 'Tradebook') {
          const merged = mergeTrades(combinedTrades, parsed.trades)
          combinedTrades = merged.trades
          names.push(file.name)
        } else {
          lastNonTrade = parsed
          names.push(file.name)
        }
      }

      setFilesLoaded([...new Set(names)])
      setPendingTrades(combinedTrades)

      if (combinedTrades.length > 0) {
        const withExisting = mergeTrades(store.trades ?? [], combinedTrades)
        const overrides: Record<string, number> = {}
        for (const s of store.stocks) {
          overrides[(s.ticker || s.name).toUpperCase()] = s.currentPrice
        }
        const analysis = analyzeTradebook(withExisting.trades, overrides)
        setResult({
          format: 'Tradebook',
          stocks: analysis.positions,
          mutualFunds: [],
          fixedDeposits: [],
          otherAssets: [],
          trades: combinedTrades,
          realizedPnl: analysis.realizedPnl,
          unrealizedPnl: analysis.unrealizedPnl,
          warnings: analysis.warnings,
          notes: [
            `${filesLoaded.length || names.length} file(s) · ${combinedTrades.length} new trade(s) in queue`,
            `After import: ${withExisting.trades.length} total trades in ledger`,
            `Open holdings: ${analysis.positions.length}`,
            `Duplicates vs existing ledger skipped: ${withExisting.skipped}`,
          ],
        })
      } else if (lastNonTrade) {
        setResult(lastNonTrade)
      }
    } catch (err) {
      if (err instanceof NumbersFormatError) {
        setError(err.message)
      } else {
        setError(err instanceof Error ? err.message : 'Failed to read file')
      }
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const isTradebook = result?.format === 'Tradebook' && (result.trades.length > 0 || pendingTrades.length > 0)
  const total =
    (result?.stocks.length ?? 0) +
    (result?.mutualFunds.length ?? 0) +
    (result?.fixedDeposits.length ?? 0) +
    (result?.otherAssets.length ?? 0) +
    (isTradebook ? pendingTrades.length : 0)

  const apply = () => {
    if (!result) return

    if (isTradebook && pendingTrades.length > 0) {
      store.addTradesFromTradebook(pendingTrades, { syncStocks: true })
      handleClose()
      return
    }

    if (total === 0) return
    if (mode === 'replace') {
      if (result.stocks.length) store.setStocks(result.stocks)
      if (result.mutualFunds.length) store.setMutualFunds(result.mutualFunds)
      if (result.fixedDeposits.length) store.setFixedDeposits(result.fixedDeposits)
      if (result.otherAssets.length) store.setOtherAssets(result.otherAssets)
    } else {
      if (result.stocks.length) {
        store.setStocks(mergeByTickerOrName(store.stocks, result.stocks))
      }
      if (result.mutualFunds.length) {
        store.setMutualFunds(
          mergeByTickerOrName(store.mutualFunds, result.mutualFunds, (m) =>
            m.name.toLowerCase().replace(/\s+/g, ''),
          ),
        )
      }
      if (result.fixedDeposits.length) {
        store.setFixedDeposits(
          mergeByTickerOrName(store.fixedDeposits, result.fixedDeposits, (f) =>
            f.name.toLowerCase().replace(/\s+/g, ''),
          ),
        )
      }
      if (result.otherAssets.length) {
        store.setOtherAssets(
          mergeByTickerOrName(store.otherAssets ?? [], result.otherAssets, (a) =>
            `${a.kind}:${a.name}`.toLowerCase().replace(/\s+/g, ''),
          ),
        )
      }
    }
    handleClose()
  }

  const canApply = isTradebook ? pendingTrades.length > 0 : total > 0 && !!result

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Import investments"
      className="sm:max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={!canApply || busy}>
            {isTradebook
              ? `Add to ledger (${pendingTrades.length} trades)`
              : `Import ${total > 0 ? `(${total})` : ''}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-surface-500">
          Import one or more Zerodha <strong>tradebooks</strong> to build full history, or a holdings
          CSV/Excel. Trades are deduped by <code className="text-xs">trade_id</code>.
        </p>

        {(store.trades?.length ?? 0) > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-800 dark:bg-brand-900/30 dark:text-brand-200">
            <Layers className="h-3.5 w-3.5" />
            Ledger already has {store.trades.length} trade(s) — new files will merge in.
          </div>
        )}

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-surface-300 bg-surface-50/80 px-4 py-8 text-center transition hover:border-brand-400 hover:bg-brand-50/40 dark:border-surface-600 dark:bg-surface-800/40 dark:hover:border-brand-600"
        >
          <FileSpreadsheet className="h-8 w-8 text-brand-600" />
          <span className="text-sm font-medium text-surface-800 dark:text-surface-100">
            {busy ? 'Reading…' : 'Choose file(s) — CSV / XLSX'}
          </span>
          <span className="text-xs text-surface-400">
            Multi-select tradebooks for full history · .numbers → export Excel first
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".csv,.xlsx,.xls,.numbers,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />

        <div className="flex flex-wrap gap-2 text-xs">
          <a
            href="/templates/investments-template.csv"
            download
            className="inline-flex items-center gap-1 rounded-lg bg-surface-100 px-2.5 py-1 font-medium text-surface-600 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300"
          >
            <Upload className="h-3 w-3" /> Download template CSV
          </a>
        </div>

        {filesLoaded.length > 0 && (
          <p className="text-xs text-surface-400">Loaded: {filesLoaded.join(', ')}</p>
        )}

        {error && (
          <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {result && (
          <div className="space-y-3 rounded-xl border border-surface-200 p-4 dark:border-surface-700">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">{result.format}</Badge>
              {canApply ? (
                <Badge variant="success">
                  <CheckCircle2 className="mr-1 inline h-3 w-3" />
                  Ready
                </Badge>
              ) : (
                <Badge variant="warning">Nothing to import</Badge>
              )}
            </div>

            {isTradebook && (
              <div className="grid grid-cols-2 gap-2">
                <StatCard
                  label="Realized P&L"
                  value={formatCurrency(result.realizedPnl ?? 0, currency, { compact: true })}
                  trend={(result.realizedPnl ?? 0) >= 0 ? 'up' : 'down'}
                />
                <StatCard
                  label="Unrealized P&L"
                  value={formatCurrency(result.unrealizedPnl ?? 0, currency, { compact: true })}
                  trend={(result.unrealizedPnl ?? 0) >= 0 ? 'up' : 'down'}
                />
              </div>
            )}

            {result.notes.map((n) => (
              <p key={n} className="text-xs text-surface-500">
                {n}
              </p>
            ))}
            {result.warnings.map((w) => (
              <div
                key={w}
                className="flex gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {w}
              </div>
            ))}

            {result.stocks.length > 0 && (
              <PreviewList
                title="Open holdings (preview)"
                items={result.stocks.map((s) => ({
                  label: s.ticker ? `${s.name} (${s.ticker})` : s.name,
                  value: formatCurrency(s.quantity * s.currentPrice, currency),
                  sub: `${s.quantity} × ${formatCurrency(s.currentPrice || s.buyPrice, currency)} · avg ${formatCurrency(s.buyPrice, currency)}`,
                }))}
              />
            )}
            {result.mutualFunds.length > 0 && (
              <PreviewList
                title="Mutual funds"
                items={result.mutualFunds.map((m) => ({
                  label: m.name,
                  value: formatCurrency(m.currentValue, currency),
                }))}
              />
            )}
            {result.fixedDeposits.length > 0 && (
              <PreviewList
                title="Fixed deposits"
                items={result.fixedDeposits.map((f) => ({
                  label: f.name,
                  value: formatCurrency(f.principal, currency),
                }))}
              />
            )}
            {result.otherAssets.length > 0 && (
              <PreviewList
                title="Gold & other"
                items={result.otherAssets.map((a) => ({
                  label: a.name,
                  value: formatCurrency(a.quantity * a.currentPrice, currency),
                  sub: `${a.kind} · ${a.quantity} ${a.unit} @ ${formatCurrency(a.currentPrice, currency)}`,
                }))}
              />
            )}

            {!isTradebook && total > 0 && (
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  variant={mode === 'merge' ? 'primary' : 'outline'}
                  onClick={() => setMode('merge')}
                >
                  Merge
                </Button>
                <Button
                  size="sm"
                  variant={mode === 'replace' ? 'primary' : 'outline'}
                  onClick={() => setMode('replace')}
                >
                  Replace
                </Button>
              </div>
            )}

            {isTradebook && (
              <p className="text-xs text-surface-400">
                You can keep adding more tradebook files above before confirming.
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

function PreviewList({
  title,
  items,
}: {
  title: string
  items: { label: string; value: string; sub?: string }[]
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-surface-400">{title}</p>
      <ul className="max-h-40 space-y-1 overflow-y-auto scrollbar-thin">
        {items.slice(0, 50).map((item) => (
          <li key={item.label + item.value} className="flex items-start justify-between gap-2 text-sm">
            <span className="min-w-0">
              <span className="block truncate text-surface-800 dark:text-surface-100">{item.label}</span>
              {item.sub && <span className="text-xs text-surface-400">{item.sub}</span>}
            </span>
            <span className="shrink-0 font-mono text-xs">{item.value}</span>
          </li>
        ))}
        {items.length > 50 && (
          <li className="text-xs text-surface-400">…and {items.length - 50} more</li>
        )}
      </ul>
    </div>
  )
}
