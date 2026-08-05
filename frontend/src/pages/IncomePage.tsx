import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, Input, EmptyState, Modal, Select } from '@/components/ui'
import { useFinanceStore } from '@/store/financeStore'
import { formatCurrency } from '@/lib/utils'
import { createId, type IncomeFrequency } from '@/types/finance'
import { monthlyIncome } from '@/lib/finance/networth'

export function IncomePage() {
  const store = useFinanceStore()
  const currency = store.profile.currency
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', amount: '', frequency: 'monthly' as IncomeFrequency })

  const add = () => {
    if (!form.name || !form.amount) return
    store.setOtherIncomes([
      ...store.otherIncomes,
      { id: createId(), name: form.name, amount: Number(form.amount), frequency: form.frequency },
    ])
    setForm({ name: '', amount: '', frequency: 'monthly' })
    setOpen(false)
  }

  const remove = (id: string) => {
    store.setOtherIncomes(store.otherIncomes.filter((i) => i.id !== id))
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50">Income</h1>
          <p className="text-sm text-surface-500">
            Total monthly ~ {formatCurrency(monthlyIncome(store), currency)}
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Add income
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Salary (monthly in-hand)</CardTitle>
        </CardHeader>
        <Input
          type="number"
          value={store.salary.monthlyInHand || ''}
          onChange={(e) => store.setSalary({ monthlyInHand: Number(e.target.value) || 0 })}
          placeholder="150000"
        />
      </Card>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-300">Other income</h2>
        {store.otherIncomes.length === 0 ? (
          <EmptyState
            title="No other income yet"
            description="Add freelance, rental, dividends, or side income."
            actionLabel="Add income"
            onAction={() => setOpen(true)}
          />
        ) : (
          store.otherIncomes.map((item) => (
            <Card key={item.id} className="flex items-center justify-between !p-4">
              <div>
                <p className="font-medium text-surface-900 dark:text-surface-50">{item.name}</p>
                <p className="text-xs capitalize text-surface-400">{item.frequency}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-semibold">
                  {formatCurrency(item.amount, currency)}
                </span>
                <Button variant="ghost" size="sm" onClick={() => remove(item.id)}>
                  <Trash2 className="h-4 w-4 text-accent-rose" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add other income"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={add}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Amount" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <Select
            label="Frequency"
            value={form.frequency}
            onChange={(e) => setForm({ ...form, frequency: e.target.value as IncomeFrequency })}
            options={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'yearly', label: 'Yearly' },
              { value: 'one-time', label: 'One-time' },
            ]}
          />
        </div>
      </Modal>
    </div>
  )
}
