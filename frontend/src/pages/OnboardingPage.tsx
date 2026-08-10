import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { Button, Input, Select, Card, Checkbox } from '@/components/ui'
import { useFinanceStore } from '@/store/financeStore'
import {
  createId,
  COVERED_PERSON_LABELS,
  COVERED_PERSON_OPTIONS,
  EXPENSE_CATEGORY_LABELS,
  INSURANCE_TYPE_LABELS,
  type CoveredPerson,
  type ExpenseCategory,
  type InsuranceType,
} from '@/types/finance'
import { cn } from '@/lib/utils'

const STEPS = [
  'Profile',
  'Income',
  'Investments',
  'Debts',
  'Insurance',
  'Expenses',
] as const

export function OnboardingPage() {
  const navigate = useNavigate()
  const store = useFinanceStore()
  const [step, setStep] = useState(0)

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1))
  const back = () => setStep((s) => Math.max(s - 1, 0))
  const finish = () => {
    store.completeOnboarding()
    navigate('/')
  }

  return (
    <div className="mx-auto min-h-svh max-w-2xl px-4 py-8">
      <div className="mb-8">
        <p className="text-sm font-medium text-brand-600">Setup</p>
        <h1 className="mt-1 text-2xl font-bold text-surface-900 dark:text-surface-50">
          {STEPS[step]}
        </h1>
        <p className="mt-1 text-sm text-surface-500">
          Step {step + 1} of {STEPS.length} — skip anything you want to add later
        </p>

        <div className="mt-6 flex gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 flex-1 rounded-full transition',
                i <= step ? 'bg-brand-500' : 'bg-surface-200 dark:bg-surface-700',
              )}
            />
          ))}
        </div>
      </div>

      <Card className="mb-6">
        {step === 0 && <ProfileStep />}
        {step === 1 && <IncomeStep />}
        {step === 2 && <InvestmentsStep />}
        {step === 3 && <DebtsStep />}
        {step === 4 && <InsuranceStep />}
        {step === 5 && <ExpensesStep />}
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={step === 0 ? () => navigate('/welcome') : back}>
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex gap-2">
          {step < STEPS.length - 1 && (
            <Button variant="ghost" onClick={next}>
              Skip
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button onClick={next}>
              Continue
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={finish}>
              <Check className="h-4 w-4" />
              Finish setup
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function ProfileStep() {
  const profile = useFinanceStore((s) => s.profile)
  const setProfile = useFinanceStore((s) => s.setProfile)

  return (
    <div className="space-y-4">
      <Input
        label="Your name"
        value={profile.name}
        onChange={(e) => setProfile({ name: e.target.value })}
        placeholder="Alex"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Age"
          type="number"
          value={profile.age || ''}
          onChange={(e) => setProfile({ age: Number(e.target.value) || 0 })}
        />
        <Input
          label="Target retirement age"
          type="number"
          value={profile.retirementAge || ''}
          onChange={(e) => setProfile({ retirementAge: Number(e.target.value) || 60 })}
        />
      </div>
      <Select
        label="Currency"
        value={profile.currency}
        onChange={(e) => setProfile({ currency: e.target.value as typeof profile.currency })}
        options={[
          { value: 'INR', label: 'INR — Indian Rupee' },
          { value: 'USD', label: 'USD — US Dollar' },
          { value: 'EUR', label: 'EUR — Euro' },
          { value: 'GBP', label: 'GBP — British Pound' },
        ]}
      />
    </div>
  )
}

function IncomeStep() {
  const salary = useFinanceStore((s) => s.salary)
  const setSalary = useFinanceStore((s) => s.setSalary)
  const otherIncomes = useFinanceStore((s) => s.otherIncomes)
  const setOtherIncomes = useFinanceStore((s) => s.setOtherIncomes)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')

  const addOther = () => {
    if (!name || !amount) return
    setOtherIncomes([
      ...otherIncomes,
      { id: createId(), name, amount: Number(amount), frequency: 'monthly' },
    ])
    setName('')
    setAmount('')
  }

  return (
    <div className="space-y-4">
      <Input
        label="Monthly gross salary"
        type="number"
        value={salary.monthlyGross || ''}
        onChange={(e) =>
          setSalary({
            monthlyGross: Number(e.target.value) || 0,
            monthlyInHand: salary.monthlyInHand || 0,
          })
        }
        placeholder="200000"
      />
      <Input
        label="Monthly in-hand salary"
        type="number"
        value={salary.monthlyInHand || ''}
        onChange={(e) =>
          setSalary({
            monthlyGross: salary.monthlyGross || 0,
            monthlyInHand: Number(e.target.value) || 0,
          })
        }
        placeholder="150000"
      />
      <p className="text-xs text-surface-500">
        Gross feeds the tax page; in-hand is used for cashflow.
      </p>
      <div className="border-t border-surface-200 pt-4 dark:border-surface-700">
        <p className="mb-3 text-sm font-medium text-surface-700 dark:text-surface-300">
          Other income (optional)
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input placeholder="Freelance / rental…" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            type="number"
            placeholder="Amount / month"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Button type="button" variant="secondary" onClick={addOther}>
            Add
          </Button>
        </div>
        {otherIncomes.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-surface-600 dark:text-surface-300">
            {otherIncomes.map((i) => (
              <li key={i.id} className="flex justify-between">
                <span>{i.name}</span>
                <span className="font-mono">{i.amount.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function InvestmentsStep() {
  const stocks = useFinanceStore((s) => s.stocks)
  const setStocks = useFinanceStore((s) => s.setStocks)
  const mutualFunds = useFinanceStore((s) => s.mutualFunds)
  const setMutualFunds = useFinanceStore((s) => s.setMutualFunds)
  const fixedDeposits = useFinanceStore((s) => s.fixedDeposits)
  const setFixedDeposits = useFinanceStore((s) => s.setFixedDeposits)
  const otherAssets = useFinanceStore((s) => s.otherAssets)
  const setOtherAssets = useFinanceStore((s) => s.setOtherAssets)

  const [stockName, setStockName] = useState('')
  const [stockValue, setStockValue] = useState('')
  const [mfName, setMfName] = useState('')
  const [mfValue, setMfValue] = useState('')
  const [fdName, setFdName] = useState('')
  const [fdValue, setFdValue] = useState('')
  const [otherName, setOtherName] = useState('')
  const [otherValue, setOtherValue] = useState('')

  return (
    <div className="space-y-6">
      <QuickAdd
        title="Stocks"
        name={stockName}
        setName={setStockName}
        value={stockValue}
        setValue={setStockValue}
        onAdd={() => {
          if (!stockName || !stockValue) return
          const v = Number(stockValue)
          setStocks([
            ...stocks,
            {
              id: createId(),
              name: stockName,
              quantity: 1,
              buyPrice: v,
              currentPrice: v,
            },
          ])
          setStockName('')
          setStockValue('')
        }}
        items={stocks.map((s) => ({ id: s.id, label: s.name, value: s.quantity * s.currentPrice }))}
      />
      <QuickAdd
        title="Mutual funds"
        name={mfName}
        setName={setMfName}
        value={mfValue}
        setValue={setMfValue}
        onAdd={() => {
          if (!mfName || !mfValue) return
          const v = Number(mfValue)
          setMutualFunds([
            ...mutualFunds,
            { id: createId(), name: mfName, investedAmount: v, currentValue: v, monthlySip: 0 },
          ])
          setMfName('')
          setMfValue('')
        }}
        items={mutualFunds.map((m) => ({ id: m.id, label: m.name, value: m.currentValue }))}
      />
      <QuickAdd
        title="Fixed deposits"
        name={fdName}
        setName={setFdName}
        value={fdValue}
        setValue={setFdValue}
        onAdd={() => {
          if (!fdName || !fdValue) return
          const today = new Date().toISOString().slice(0, 10)
          setFixedDeposits([
            ...fixedDeposits,
            {
              id: createId(),
              name: fdName,
              principal: Number(fdValue),
              interestRate: 7,
              startDate: today,
              maturityDate: today,
            },
          ])
          setFdName('')
          setFdValue('')
        }}
        items={fixedDeposits.map((f) => ({ id: f.id, label: f.name, value: f.principal }))}
      />
      <QuickAdd
        title="Gold / silver / other"
        name={otherName}
        setName={setOtherName}
        value={otherValue}
        setValue={setOtherValue}
        onAdd={() => {
          if (!otherName || !otherValue) return
          const v = Number(otherValue)
          if (!Number.isFinite(v) || v <= 0) return
          const kind = /silver/i.test(otherName) ? 'silver' : /gold/i.test(otherName) ? 'gold' : 'other'
          setOtherAssets([
            ...(otherAssets ?? []),
            {
              id: createId(),
              name: otherName,
              kind,
              quantity: 1,
              unit: 'units',
              buyPrice: v,
              currentPrice: v,
            },
          ])
          setOtherName('')
          setOtherValue('')
        }}
        items={(otherAssets ?? []).map((a) => ({
          id: a.id,
          label: a.name,
          value: a.quantity * a.currentPrice,
        }))}
      />
    </div>
  )
}

function QuickAdd({
  title,
  name,
  setName,
  value,
  setValue,
  onAdd,
  items,
}: {
  title: string
  name: string
  setName: (v: string) => void
  value: string
  setValue: (v: string) => void
  onAdd: () => void
  items: { id: string; label: string; value: number }[]
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-surface-700 dark:text-surface-300">{title}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          type="number"
          placeholder="Current value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button type="button" variant="secondary" onClick={onAdd}>
          Add
        </Button>
      </div>
      {items.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm text-surface-600">
          {items.map((i) => (
            <li key={i.id} className="flex justify-between">
              <span>{i.label}</span>
              <span className="font-mono">{i.value.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function DebtsStep() {
  const homeLoans = useFinanceStore((s) => s.homeLoans)
  const setHomeLoans = useFinanceStore((s) => s.setHomeLoans)
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
    setHomeLoans([
      ...homeLoans,
      {
        id: createId(),
        name: form.name || 'Home Loan',
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
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-surface-500">Add your home loan details (editable later with rate changes & prepayments).</p>
      <Input label="Loan name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Market value" type="number" value={form.marketValue} onChange={(e) => setForm({ ...form, marketValue: e.target.value })} />
        <Input label="Purchase price" type="number" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
        <Input label="Down payment" type="number" value={form.downPayment} onChange={(e) => setForm({ ...form, downPayment: e.target.value })} />
        <Input label="Loan amount" type="number" value={form.loanAmount} onChange={(e) => setForm({ ...form, loanAmount: e.target.value })} />
        <Input label="Interest rate %" type="number" step="0.01" value={form.interestRate} onChange={(e) => setForm({ ...form, interestRate: e.target.value })} />
        <Input label="Tenure (months)" type="number" value={form.tenureMonths} onChange={(e) => setForm({ ...form, tenureMonths: e.target.value })} />
        <Input label="Loan start date" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
      </div>
      <Button type="button" variant="secondary" onClick={add}>
        Add home loan
      </Button>
      {homeLoans.length > 0 && (
        <p className="text-sm text-brand-600">{homeLoans.length} loan(s) added</p>
      )}
    </div>
  )
}

function InsuranceStep() {
  const healthInsurance = useFinanceStore((s) => s.healthInsurance)
  const setHealthInsurance = useFinanceStore((s) => s.setHealthInsurance)
  const [type, setType] = useState<InsuranceType>('health')
  const [provider, setProvider] = useState('')
  const [cover, setCover] = useState('')
  const [premium, setPremium] = useState('')
  const [peopleCovered, setPeopleCovered] = useState<CoveredPerson[]>([])

  const togglePerson = (person: CoveredPerson, checked: boolean) => {
    setPeopleCovered((prev) =>
      checked ? [...prev, person] : prev.filter((p) => p !== person),
    )
  }

  const add = () => {
    if (!provider || !premium) return
    setHealthInsurance([
      ...healthInsurance,
      {
        id: createId(),
        provider,
        type,
        coverAmount: Number(cover) || 0,
        premium: Number(premium),
        frequency: 'yearly',
        renewalDate: new Date().toISOString().slice(0, 10),
        peopleCovered,
      },
    ])
    setProvider('')
    setCover('')
    setPremium('')
    setPeopleCovered([])
    setType('health')
  }

  return (
    <div className="space-y-4">
      <Select
        label="Type"
        value={type}
        onChange={(e) => setType(e.target.value as InsuranceType)}
        options={[
          { value: 'health', label: 'Health insurance' },
          { value: 'term', label: 'Term insurance' },
        ]}
      />
      <Input label="Provider" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="HDFC Ergo…" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={type === 'term' ? 'Sum assured' : 'Cover amount'}
          type="number"
          value={cover}
          onChange={(e) => setCover(e.target.value)}
        />
        <Input label="Annual premium" type="number" value={premium} onChange={(e) => setPremium(e.target.value)} />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-surface-700 dark:text-surface-200">
          People covered
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {COVERED_PERSON_OPTIONS.map((person) => (
            <Checkbox
              key={person}
              label={COVERED_PERSON_LABELS[person]}
              checked={peopleCovered.includes(person)}
              onChange={(checked) => togglePerson(person, checked)}
            />
          ))}
        </div>
      </div>
      <Button type="button" variant="secondary" onClick={add}>
        Add policy
      </Button>
      {healthInsurance.map((p) => (
        <p key={p.id} className="text-sm text-surface-600">
          {INSURANCE_TYPE_LABELS[p.type ?? 'health']} · {p.provider} — cover{' '}
          {p.coverAmount.toLocaleString()}
          {(p.peopleCovered?.length ?? 0) > 0
            ? ` · ${p.peopleCovered.map((person) => COVERED_PERSON_LABELS[person]).join(', ')}`
            : ''}
        </p>
      ))}
    </div>
  )
}

function ExpensesStep() {
  const expenses = useFinanceStore((s) => s.expenses)
  const setExpenses = useFinanceStore((s) => s.setExpenses)
  const [category, setCategory] = useState<ExpenseCategory>('groceries')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')

  const add = () => {
    if (!amount) return
    setExpenses([
      ...expenses,
      {
        id: createId(),
        category,
        name: name || EXPENSE_CATEGORY_LABELS[category],
        amount: Number(amount),
      },
    ])
    setName('')
    setAmount('')
  }

  return (
    <div className="space-y-4">
      <Select
        label="Category"
        value={category}
        onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
        options={Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))}
      />
      <Input label="Label (optional)" value={name} onChange={(e) => setName(e.target.value)} />
      <Input label="Monthly amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <Button type="button" variant="secondary" onClick={add}>
        Add expense
      </Button>
      {expenses.length > 0 && (
        <ul className="space-y-1 text-sm">
          {expenses.map((e) => (
            <li key={e.id} className="flex justify-between text-surface-600">
              <span>{e.name}</span>
              <span className="font-mono">{e.amount.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
