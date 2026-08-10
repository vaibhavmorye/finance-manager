import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, Calculator, ArrowRight, Pencil } from 'lucide-react'
import { Button, Card, Input, EmptyState, Modal, Badge, Select } from '@/components/ui'
import { useFinanceStore } from '@/store/financeStore'
import { formatCurrency, formatMonths } from '@/lib/utils'
import {
  createId,
  type HomeLoan,
  type OtherDebt,
  type Prepayment,
  type PrepaymentFrequency,
} from '@/types/finance'
import {
  calculateEmi,
  effectiveLoanEmi,
  effectiveLoanOutstanding,
  estimatedAmountPaid,
  frequencyLabel,
  generateAmortization,
} from '@/lib/finance/loan'
import { homeLoanOutstanding } from '@/lib/finance/networth'

const PREPAY_FREQ_OPTIONS: { value: PrepaymentFrequency; label: string }[] = [
  { value: 'one_time', label: 'One-time' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'half_yearly', label: 'Half-yearly' },
  { value: 'annually', label: 'Annually' },
]

type LoanForm = {
  name: string
  marketValue: string
  purchasePrice: string
  downPayment: string
  loanAmount: string
  interestRate: string
  tenureMonths: string
  startDate: string
  emi: string
  amountPaid: string
}

const emptyLoanForm = (): LoanForm => ({
  name: 'Home Loan',
  marketValue: '',
  purchasePrice: '',
  downPayment: '',
  loanAmount: '',
  interestRate: '8.5',
  tenureMonths: '240',
  startDate: new Date().toISOString().slice(0, 10),
  emi: '',
  amountPaid: '0',
})

function loanToForm(loan: HomeLoan): LoanForm {
  const calc = calculateEmi(loan.loanAmount, loan.interestRate, loan.tenureMonths)
  const paid =
    loan.amountPaid != null
      ? loan.amountPaid
      : estimatedAmountPaid(loan)
  return {
    name: loan.name,
    marketValue: String(loan.marketValue || ''),
    purchasePrice: String(loan.purchasePrice || ''),
    downPayment: String(loan.downPayment || ''),
    loanAmount: String(loan.loanAmount || ''),
    interestRate: String(loan.interestRate || ''),
    tenureMonths: String(loan.tenureMonths || ''),
    startDate: loan.startDate,
    emi: String(loan.emi != null && loan.emi > 0 ? Math.round(loan.emi) : Math.round(calc)),
    amountPaid: String(Math.round(paid)),
  }
}

function formToLoanFields(form: LoanForm) {
  const loanAmount = Number(form.loanAmount) || 0
  const interestRate = Number(form.interestRate) || 0
  const tenureMonths = Number(form.tenureMonths) || 240
  const calc = calculateEmi(loanAmount, interestRate, tenureMonths)
  const emiRaw = form.emi.trim() === '' ? calc : Number(form.emi)
  const paidRaw = form.amountPaid.trim() === '' ? 0 : Number(form.amountPaid)
  return {
    name: form.name.trim() || 'Home Loan',
    marketValue: Number(form.marketValue) || 0,
    purchasePrice: Number(form.purchasePrice) || 0,
    downPayment: Number(form.downPayment) || 0,
    loanAmount,
    startDate: form.startDate,
    interestRate,
    tenureMonths,
    emi: Number.isFinite(emiRaw) && emiRaw > 0 ? emiRaw : calc,
    amountPaid: Number.isFinite(paidRaw) && paidRaw >= 0 ? Math.min(paidRaw, loanAmount) : 0,
  }
}

export function DebtsPage() {
  const store = useFinanceStore()
  const currency = store.profile.currency
  const [loanModal, setLoanModal] = useState<'add' | 'edit' | null>(null)
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null)
  const [loanForm, setLoanForm] = useState<LoanForm>(emptyLoanForm)

  const [prepayLoanId, setPrepayLoanId] = useState<string | null>(null)
  const [editingPrepayId, setEditingPrepayId] = useState<string | null>(null)
  const [prepayForm, setPrepayForm] = useState({
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    frequency: 'monthly' as PrepaymentFrequency,
    endDate: '',
  })

  const [otherModal, setOtherModal] = useState<'add' | 'edit' | null>(null)
  const [editingOtherId, setEditingOtherId] = useState<string | null>(null)
  const [otherForm, setOtherForm] = useState({
    name: '',
    principal: '',
    interestRate: '',
    emi: '',
    remainingMonths: '',
  })

  const prepayLoan = store.homeLoans.find((l) => l.id === prepayLoanId) ?? null

  const openAddLoan = () => {
    setEditingLoanId(null)
    setLoanForm(emptyLoanForm())
    setLoanModal('add')
  }

  const openEditLoan = (loan: HomeLoan) => {
    setEditingLoanId(loan.id)
    setLoanForm(loanToForm(loan))
    setLoanModal('edit')
  }

  const saveLoan = () => {
    const fields = formToLoanFields(loanForm)
    if (!fields.loanAmount) return

    if (loanModal === 'edit' && editingLoanId) {
      store.setHomeLoans(
        store.homeLoans.map((l) => (l.id === editingLoanId ? { ...l, ...fields } : l)),
      )
    } else {
      store.setHomeLoans([
        ...store.homeLoans,
        {
          id: createId(),
          ...fields,
          rateChanges: [],
          prepayments: [],
        },
      ])
    }
    setLoanModal(null)
  }

  const openAddPrepay = (loanId: string) => {
    setPrepayLoanId(loanId)
    setEditingPrepayId(null)
    setPrepayForm({
      amount: '',
      date: new Date().toISOString().slice(0, 10),
      frequency: 'monthly',
      endDate: '',
    })
  }

  const openEditPrepay = (loan: HomeLoan, p: Prepayment) => {
    setPrepayLoanId(loan.id)
    setEditingPrepayId(p.id)
    setPrepayForm({
      amount: String(p.amount),
      date: p.date,
      frequency: p.frequency ?? 'one_time',
      endDate: p.endDate ?? '',
    })
  }

  const savePrepay = () => {
    if (!prepayLoanId) return
    const amount = Number(prepayForm.amount)
    if (!Number.isFinite(amount) || amount <= 0) return

    const entry: Prepayment = {
      id: editingPrepayId ?? createId(),
      date: prepayForm.date,
      amount,
      frequency: prepayForm.frequency,
      endDate:
        prepayForm.frequency !== 'one_time' && prepayForm.endDate
          ? prepayForm.endDate
          : undefined,
    }

    store.setHomeLoans(
      store.homeLoans.map((l) => {
        if (l.id !== prepayLoanId) return l
        const prepayments = editingPrepayId
          ? l.prepayments.map((p) => (p.id === editingPrepayId ? entry : p))
          : [...l.prepayments, entry]
        return { ...l, prepayments }
      }),
    )
    setPrepayLoanId(null)
    setEditingPrepayId(null)
  }

  const removePrepay = (loanId: string, prepayId: string) => {
    store.setHomeLoans(
      store.homeLoans.map((l) =>
        l.id === loanId
          ? { ...l, prepayments: l.prepayments.filter((p) => p.id !== prepayId) }
          : l,
      ),
    )
  }

  const openAddOther = () => {
    setEditingOtherId(null)
    setOtherForm({ name: '', principal: '', interestRate: '', emi: '', remainingMonths: '' })
    setOtherModal('add')
  }

  const openEditOther = (debt: OtherDebt) => {
    setEditingOtherId(debt.id)
    setOtherForm({
      name: debt.name,
      principal: String(debt.principal),
      interestRate: String(debt.interestRate),
      emi: String(debt.emi),
      remainingMonths: String(debt.remainingMonths),
    })
    setOtherModal('edit')
  }

  const saveOther = () => {
    if (!otherForm.name || !otherForm.principal) return
    const next: OtherDebt = {
      id: editingOtherId ?? createId(),
      name: otherForm.name,
      principal: Number(otherForm.principal) || 0,
      interestRate: Number(otherForm.interestRate) || 0,
      emi: Number(otherForm.emi) || 0,
      remainingMonths: Number(otherForm.remainingMonths) || 0,
    }
    if (otherModal === 'edit' && editingOtherId) {
      store.setOtherDebts(store.otherDebts.map((d) => (d.id === editingOtherId ? next : d)))
    } else {
      store.setOtherDebts([...store.otherDebts, next])
    }
    setOtherModal(null)
  }

  const emiPreview = useMemo(() => {
    const amount = Number(loanForm.loanAmount) || 0
    const rate = Number(loanForm.interestRate) || 0
    const tenure = Number(loanForm.tenureMonths) || 0
    return calculateEmi(amount, rate, tenure)
  }, [loanForm.loanAmount, loanForm.interestRate, loanForm.tenureMonths])

  const remainingPreview = useMemo(() => {
    const amount = Number(loanForm.loanAmount) || 0
    const paid = Number(loanForm.amountPaid) || 0
    return Math.max(0, amount - paid)
  }, [loanForm.loanAmount, loanForm.amountPaid])

  const applyCalculatedEmi = () => {
    if (emiPreview <= 0) return
    setLoanForm((f) => ({ ...f, emi: String(Math.round(emiPreview)) }))
  }

  const applyEstimatedPaid = () => {
    const loanAmount = Number(loanForm.loanAmount) || 0
    const interestRate = Number(loanForm.interestRate) || 0
    const tenureMonths = Number(loanForm.tenureMonths) || 0
    const emi = Number(loanForm.emi) || emiPreview
    if (!loanAmount || !tenureMonths || !loanForm.startDate) return
    const paid = estimatedAmountPaid({
      loanAmount,
      interestRate,
      tenureMonths,
      startDate: loanForm.startDate,
      emi: emi > 0 ? emi : undefined,
    })
    setLoanForm((f) => ({ ...f, amountPaid: String(Math.round(paid)) }))
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
        <div className="flex flex-wrap gap-2">
          <Link to="/calculators/home-loan">
            <Button variant="outline">
              <Calculator className="h-4 w-4" /> Loan calculator
            </Button>
          </Link>
          <Button variant="outline" onClick={openAddOther}>
            <Plus className="h-4 w-4" /> Add other debt
          </Button>
          <Button onClick={openAddLoan}>
            <Plus className="h-4 w-4" /> Add loan
          </Button>
        </div>
      </div>

      {store.homeLoans.length === 0 && store.otherDebts.length === 0 ? (
        <EmptyState
          title="No loans yet"
          description="Add a home loan with purchase details, rate, tenure, and prepayment schedule."
          actionLabel="Add home loan"
          onAction={openAddLoan}
        />
      ) : (
        <div className="space-y-4">
          {store.homeLoans.map((loan) => (
            <HomeLoanCard
              key={loan.id}
              loan={loan}
              currency={currency}
              onEdit={() => openEditLoan(loan)}
              onDelete={() => store.setHomeLoans(store.homeLoans.filter((l) => l.id !== loan.id))}
              onAddPrepay={() => openAddPrepay(loan.id)}
              onEditPrepay={(p) => openEditPrepay(loan, p)}
              onRemovePrepay={(id) => removePrepay(loan.id, id)}
            />
          ))}

          {store.otherDebts.map((debt) => (
            <Card key={debt.id} className="!p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-surface-900 dark:text-surface-50">{debt.name}</h3>
                    <Badge>Other debt</Badge>
                  </div>
                  <p className="mt-1 text-sm text-surface-500">
                    {debt.interestRate}% · {debt.remainingMonths} mo left
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEditOther(debt)} aria-label="Edit debt">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => store.setOtherDebts(store.otherDebts.filter((d) => d.id !== debt.id))}
                    aria-label="Delete debt"
                  >
                    <Trash2 className="h-4 w-4 text-accent-rose" />
                  </Button>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Metric label="Principal" value={formatCurrency(debt.principal, currency, { compact: true })} />
                <Metric label="EMI" value={formatCurrency(debt.emi, currency)} />
                <Metric label="Remaining" value={`${debt.remainingMonths} mo`} />
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={loanModal !== null}
        onClose={() => setLoanModal(null)}
        title={loanModal === 'edit' ? 'Edit home loan' : 'Add home loan'}
        className="sm:max-w-xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setLoanModal(null)}>
              Cancel
            </Button>
            <Button onClick={saveLoan}>Save</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            className="sm:col-span-2"
            label="Name"
            value={loanForm.name}
            onChange={(e) => setLoanForm({ ...loanForm, name: e.target.value })}
          />
          <Input
            label="Market value"
            type="number"
            value={loanForm.marketValue}
            onChange={(e) => setLoanForm({ ...loanForm, marketValue: e.target.value })}
          />
          <Input
            label="Purchase price"
            type="number"
            value={loanForm.purchasePrice}
            onChange={(e) => setLoanForm({ ...loanForm, purchasePrice: e.target.value })}
          />
          <Input
            label="Down payment"
            type="number"
            value={loanForm.downPayment}
            onChange={(e) => setLoanForm({ ...loanForm, downPayment: e.target.value })}
          />
          <Input
            label="Loan amount"
            type="number"
            value={loanForm.loanAmount}
            onChange={(e) => setLoanForm({ ...loanForm, loanAmount: e.target.value })}
          />
          <Input
            label="Interest rate %"
            type="number"
            step="0.01"
            value={loanForm.interestRate}
            onChange={(e) => setLoanForm({ ...loanForm, interestRate: e.target.value })}
          />
          <Input
            label="Tenure (months)"
            type="number"
            value={loanForm.tenureMonths}
            onChange={(e) => setLoanForm({ ...loanForm, tenureMonths: e.target.value })}
          />
          <Input
            label="Start date"
            type="date"
            value={loanForm.startDate}
            onChange={(e) => setLoanForm({ ...loanForm, startDate: e.target.value })}
          />
          <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Input
                label="Current EMI"
                type="number"
                value={loanForm.emi}
                onChange={(e) => setLoanForm({ ...loanForm, emi: e.target.value })}
                hint={
                  emiPreview > 0
                    ? `Formula EMI ~ ${formatCurrency(emiPreview, currency)}`
                    : undefined
                }
              />
              <Button type="button" variant="ghost" size="sm" onClick={applyCalculatedEmi}>
                Use formula EMI
              </Button>
            </div>
            <div className="space-y-1.5">
              <Input
                label="Amount paid till now"
                type="number"
                value={loanForm.amountPaid}
                onChange={(e) => setLoanForm({ ...loanForm, amountPaid: e.target.value })}
                hint={
                  remainingPreview >= 0
                    ? `Outstanding ~ ${formatCurrency(remainingPreview, currency)}`
                    : undefined
                }
              />
              <Button type="button" variant="ghost" size="sm" onClick={applyEstimatedPaid}>
                Estimate from schedule
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!prepayLoan}
        onClose={() => {
          setPrepayLoanId(null)
          setEditingPrepayId(null)
        }}
        title={editingPrepayId ? 'Edit prepayment' : 'Add prepayment'}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setPrepayLoanId(null)
                setEditingPrepayId(null)
              }}
            >
              Cancel
            </Button>
            <Button onClick={savePrepay}>Save</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Amount"
            type="number"
            value={prepayForm.amount}
            onChange={(e) => setPrepayForm({ ...prepayForm, amount: e.target.value })}
          />
          <Select
            label="Schedule"
            value={prepayForm.frequency}
            onChange={(e) =>
              setPrepayForm({ ...prepayForm, frequency: e.target.value as PrepaymentFrequency })
            }
            options={PREPAY_FREQ_OPTIONS}
          />
          <Input
            label={prepayForm.frequency === 'one_time' ? 'Payment date' : 'Start date'}
            type="date"
            value={prepayForm.date}
            onChange={(e) => setPrepayForm({ ...prepayForm, date: e.target.value })}
          />
          {prepayForm.frequency !== 'one_time' && (
            <Input
              label="End date (optional)"
              type="date"
              value={prepayForm.endDate}
              onChange={(e) => setPrepayForm({ ...prepayForm, endDate: e.target.value })}
              hint="Leave blank to continue until the loan ends"
            />
          )}
        </div>
      </Modal>

      <Modal
        open={otherModal !== null}
        onClose={() => setOtherModal(null)}
        title={otherModal === 'edit' ? 'Edit other debt' : 'Add other debt'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOtherModal(null)}>
              Cancel
            </Button>
            <Button onClick={saveOther}>Save</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            className="sm:col-span-2"
            label="Name"
            value={otherForm.name}
            onChange={(e) => setOtherForm({ ...otherForm, name: e.target.value })}
          />
          <Input
            label="Principal"
            type="number"
            value={otherForm.principal}
            onChange={(e) => setOtherForm({ ...otherForm, principal: e.target.value })}
          />
          <Input
            label="Interest rate %"
            type="number"
            value={otherForm.interestRate}
            onChange={(e) => setOtherForm({ ...otherForm, interestRate: e.target.value })}
          />
          <Input
            label="EMI"
            type="number"
            value={otherForm.emi}
            onChange={(e) => setOtherForm({ ...otherForm, emi: e.target.value })}
          />
          <Input
            label="Remaining months"
            type="number"
            value={otherForm.remainingMonths}
            onChange={(e) => setOtherForm({ ...otherForm, remainingMonths: e.target.value })}
          />
        </div>
      </Modal>
    </div>
  )
}

function HomeLoanCard({
  loan,
  currency,
  onEdit,
  onDelete,
  onAddPrepay,
  onEditPrepay,
  onRemovePrepay,
}: {
  loan: HomeLoan
  currency: 'INR' | 'USD' | 'EUR' | 'GBP'
  onEdit: () => void
  onDelete: () => void
  onAddPrepay: () => void
  onEditPrepay: (p: Prepayment) => void
  onRemovePrepay: (id: string) => void
}) {
  const summary = useMemo(
    () =>
      generateAmortization({
        principal: loan.loanAmount,
        annualRate: loan.interestRate,
        tenureMonths: loan.tenureMonths,
        startDate: loan.startDate,
        emiOverride: loan.emi,
        rateChanges: loan.rateChanges,
        prepayments: loan.prepayments,
      }),
    [loan],
  )
  const emi = effectiveLoanEmi(loan)
  const outstanding = effectiveLoanOutstanding(loan)
  const paid =
    loan.amountPaid != null ? loan.amountPaid : Math.max(0, loan.loanAmount - outstanding)
  const monthsLeft = summary.schedule.filter(
    (r) => r.date > new Date().toISOString().slice(0, 10),
  ).length

  return (
    <Card className="!p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-surface-900 dark:text-surface-50">{loan.name}</h3>
            <Badge variant="warning">Home loan</Badge>
          </div>
          <p className="mt-1 text-sm text-surface-500">
            {formatMonths(loan.tenureMonths)} · {loan.interestRate}% · started {loan.startDate}
            {monthsLeft > 0 ? ` · ~${formatMonths(monthsLeft)} left` : ''}
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onEdit} aria-label="Edit loan">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} aria-label="Delete loan">
            <Trash2 className="h-4 w-4 text-accent-rose" />
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Loan amount" value={formatCurrency(loan.loanAmount, currency, { compact: true })} />
        <Metric label="EMI" value={formatCurrency(emi, currency)} />
        <Metric label="Paid till now" value={formatCurrency(paid, currency, { compact: true })} />
        <Metric label="Outstanding" value={formatCurrency(outstanding, currency, { compact: true })} />
      </div>

      <div className="mt-4 border-t border-surface-100 pt-4 dark:border-surface-800">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-surface-700 dark:text-surface-200">Prepayments</p>
          <Button variant="ghost" size="sm" onClick={onAddPrepay}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
        {loan.prepayments.length === 0 ? (
          <p className="text-xs text-surface-400">
            No prepayments yet. Add monthly, quarterly, half-yearly, or annual extras.
          </p>
        ) : (
          <ul className="space-y-2">
            {loan.prepayments.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-50 px-3 py-2 dark:bg-surface-800/50"
              >
                <div>
                  <p className="text-sm font-medium">
                    {formatCurrency(p.amount, currency)} · {frequencyLabel(p.frequency ?? 'one_time')}
                  </p>
                  <p className="text-xs text-surface-400">
                    From {p.date}
                    {p.endDate ? ` → ${p.endDate}` : p.frequency && p.frequency !== 'one_time' ? ' → loan end' : ''}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onEditPrepay(p)} aria-label="Edit prepayment">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemovePrepay(p.id)}
                    aria-label="Delete prepayment"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-accent-rose" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {loan.rateChanges.length > 0 && (
        <p className="mt-3 text-xs text-surface-400">{loan.rateChanges.length} rate change(s) recorded</p>
      )}
      <Link
        to={`/calculators/home-loan?loanId=${loan.id}`}
        className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600"
      >
        Open in calculator <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </Card>
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