import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button, Card, Tabs, Input, EmptyState, Modal } from '@/components/ui'
import { useFinanceStore } from '@/store/financeStore'
import { formatCurrency } from '@/lib/utils'
import { createId } from '@/types/finance'
import { stocksValue, fdValue, mfValue } from '@/lib/finance/networth'

export function InvestmentsPage() {
  const store = useFinanceStore()
  const currency = store.profile.currency
  const [tab, setTab] = useState('stocks')
  const [open, setOpen] = useState(false)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50">Investments</h1>
          <p className="text-sm text-surface-500">
            Stocks {formatCurrency(stocksValue(store), currency, { compact: true })} · MF{' '}
            {formatCurrency(mfValue(store), currency, { compact: true })} · FD{' '}
            {formatCurrency(fdValue(store), currency, { compact: true })}
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      <Tabs
        tabs={[
          { id: 'stocks', label: 'Stocks' },
          { id: 'mf', label: 'Mutual funds' },
          { id: 'fd', label: 'Fixed deposits' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'stocks' && (
        <List
          empty="No stocks yet"
          items={store.stocks.map((s) => ({
            id: s.id,
            title: s.ticker ? `${s.name} (${s.ticker})` : s.name,
            sub: `${s.quantity} × ${formatCurrency(s.currentPrice, currency)}`,
            value: s.quantity * s.currentPrice,
          }))}
          currency={currency}
          onRemove={(id) => store.setStocks(store.stocks.filter((s) => s.id !== id))}
          onAdd={() => setOpen(true)}
        />
      )}
      {tab === 'mf' && (
        <List
          empty="No mutual funds yet"
          items={store.mutualFunds.map((m) => ({
            id: m.id,
            title: m.name,
            sub: m.monthlySip ? `SIP ${formatCurrency(m.monthlySip, currency)}/mo` : 'No SIP',
            value: m.currentValue,
          }))}
          currency={currency}
          onRemove={(id) => store.setMutualFunds(store.mutualFunds.filter((m) => m.id !== id))}
          onAdd={() => setOpen(true)}
        />
      )}
      {tab === 'fd' && (
        <List
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

      <AddInvestmentModal open={open} onClose={() => setOpen(false)} defaultTab={tab} />
    </div>
  )
}

function List({
  empty,
  items,
  currency,
  onRemove,
  onAdd,
}: {
  empty: string
  items: { id: string; title: string; sub: string; value: number }[]
  currency: 'INR' | 'USD' | 'EUR' | 'GBP'
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
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-semibold">
              {formatCurrency(item.value, currency)}
            </span>
            <Button variant="ghost" size="sm" onClick={() => onRemove(item.id)}>
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
  const [type, setType] = useState(defaultTab)
  const [form, setForm] = useState({
    name: '',
    ticker: '',
    quantity: '1',
    price: '',
    invested: '',
    current: '',
    sip: '',
    rate: '7',
    start: new Date().toISOString().slice(0, 10),
    maturity: new Date().toISOString().slice(0, 10),
  })

  const save = () => {
    if (type === 'stocks' && form.name && form.price) {
      store.setStocks([
        ...store.stocks,
        {
          id: createId(),
          name: form.name,
          ticker: form.ticker || undefined,
          quantity: Number(form.quantity) || 1,
          buyPrice: Number(form.price),
          currentPrice: Number(form.price),
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
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
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
          ]}
          active={type}
          onChange={setType}
        />
        <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        {type === 'stocks' && (
          <>
            <Input label="Ticker (optional)" value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Quantity" type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              <Input label="Current price" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
          </>
        )}
        {type === 'mf' && (
          <>
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
            <Input label="Interest rate %" type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Start" type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
              <Input label="Maturity" type="date" value={form.maturity} onChange={(e) => setForm({ ...form, maturity: e.target.value })} />
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
