import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, Calculator, ArrowRight } from 'lucide-react'
import { Button, Card, Input, EmptyState, Modal, Badge } from '@/components/ui'
import { useFinanceStore } from '@/store/financeStore'
import { formatCurrency, formatMonths } from '@/lib/utils'
import { createId } from '@/types/finance'
import { calculateEmi } from '@/lib/finance/loan'
import { homeLoanOutstanding } from '@/lib/finance/networth'

export function DebtsPage() {
  const store = useFinanceStore()
  const currency = store.profile.currency
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    name: 'Home Loan',
    marketValue: '',
    purchasePrice: '',
    downPayment: '',
    loanAmount: '',
    interestRate: '8.5',
    tenureMonths: '240',
    startDate: new Date().toISOString().slice(0, 10),
  })

  const add = () => {
    if (!form.loanAmount) return
    store.setHomeLoans([
      ...store.homeLoans,
      {
        id: createId(),
        name: form.name,
        marketValue: Number(form.marketValue) || 0,
        purchasePrice: Number(form.purchasePrice) || 0,
        downPayment: Number(form.downPayment) || 0,
        loanAmount: Number(form.loanAmount),
        startDate: form.startDate,
        interestRate: Number(form.interestRate) || 0,
        tenureMonths: Number(form.tenureMonths) || 240,
        rateChanges: [],
        prepayments: [],
      },
    ])
    setOpen(false)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50">Debts & loans</h1>
          <p className="text-sm text-surface-500">
            Outstanding ~ {formatCurrency(homeLoanOutstanding(store), currency, { compact: true })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/calculators/home-loan">
            <Button variant="outline">
              <Calculator className="h-4 w-4" /> Loan calculator
            </Button>
          </Link>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add loan
          </Button>
        </div>
      </div>

      {store.homeLoans.length === 0 && store.otherDebts.length === 0 ? (
        <EmptyState
          title="No loans yet"
          description="Add a home loan with purchase details, rate, and tenure."
          actionLabel="Add home loan"
          onAction={() => setOpen(true)}
        />
      ) : (
        <div className="space-y-3">
          {store.homeLoans.map((loan) => {
            const emi = calculateEmi(loan.loanAmount, loan.interestRate, loan.tenureMonths)
            return (
              <Card key={loan.id} className="!p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-surface-900 dark:text-surface-50">{loan.name}</h3>
                      <Badge variant="warning">Home loan</Badge>
                    </div>
                    <p className="mt-1 text-sm text-surface-500">
                      {formatMonths(loan.tenureMonths)} · {loan.interestRate}% · started {loan.startDate}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => store.setHomeLoans(store.homeLoans.filter((l) => l.id !== loan.id))}
                  >
                    <Trash2 className="h-4 w-4 text-accent-rose" />
                  </Button>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <Metric label="Loan amount" value={formatCurrency(loan.loanAmount, currency, { compact: true })} />
                  <Metric label="EMI" value={formatCurrency(emi, currency)} />
                  <Metric label="Market value" value={formatCurrency(loan.marketValue, currency, { compact: true })} />
                  <Metric label="Down payment" value={formatCurrency(loan.downPayment, currency, { compact: true })} />
                </div>
                {loan.rateChanges.length > 0 && (
                  <p className="mt-3 text-xs text-surface-400">
                    {loan.rateChanges.length} rate change(s) recorded
                  </p>
                )}
                <Link
                  to={`/calculators/home-loan?loanId=${loan.id}`}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600"
                >
                  Open in calculator <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Card>
            )
          })}

          {store.otherDebts.map((debt) => (
            <Card key={debt.id} className="flex items-center justify-between !p-4">
              <div>
                <p className="font-medium">{debt.name}</p>
                <p className="text-xs text-surface-400">
                  {debt.interestRate}% · {debt.remainingMonths} mo left
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm">{formatCurrency(debt.principal, currency)}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => store.setOtherDebts(store.otherDebts.filter((d) => d.id !== debt.id))}
                >
                  <Trash2 className="h-4 w-4 text-accent-rose" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add home loan"
        className="sm:max-w-xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={add}>Save</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Input className="sm:col-span-2" label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Market value" type="number" value={form.marketValue} onChange={(e) => setForm({ ...form, marketValue: e.target.value })} />
          <Input label="Purchase price" type="number" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
          <Input label="Down payment" type="number" value={form.downPayment} onChange={(e) => setForm({ ...form, downPayment: e.target.value })} />
          <Input label="Loan amount" type="number" value={form.loanAmount} onChange={(e) => setForm({ ...form, loanAmount: e.target.value })} />
          <Input label="Interest rate %" type="number" step="0.01" value={form.interestRate} onChange={(e) => setForm({ ...form, interestRate: e.target.value })} />
          <Input label="Tenure (months)" type="number" value={form.tenureMonths} onChange={(e) => setForm({ ...form, tenureMonths: e.target.value })} />
          <Input label="Start date" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        </div>
      </Modal>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-50 px-3 py-2 dark:bg-surface-800/50">
      <p className="text-xs text-surface-400">{label}</p>
      <p className="font-mono text-sm font-semibold text-surface-800 dark:text-surface-100">{value}</p>
    </div>
  )
}
