import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button, Card, Input, Select, EmptyState, Modal } from '@/components/ui'
import { useFinanceStore } from '@/store/financeStore'
import { formatCurrency } from '@/lib/utils'
import { createId, EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from '@/types/finance'
import { monthlyExpensesTotal } from '@/lib/finance/networth'

export function ExpensesPage() {
  const store = useFinanceStore()
  const currency = store.profile.currency
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    category: 'groceries' as ExpenseCategory,
    name: '',
    amount: '',
  })

  const add = () => {
    if (!form.amount) return
    store.setExpenses([
      ...store.expenses,
      {
        id: createId(),
        category: form.category,
        name: form.name || EXPENSE_CATEGORY_LABELS[form.category],
        amount: Number(form.amount),
      },
    ])
    setForm({ category: 'groceries', name: '', amount: '' })
    setOpen(false)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50">Expenses</h1>
          <p className="text-sm text-surface-500">
            Monthly total {formatCurrency(monthlyExpensesTotal(store), currency)}
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {store.expenses.length === 0 ? (
        <EmptyState
          title="No expenses yet"
          description="Track rent, groceries, utilities and more."
          actionLabel="Add expense"
          onAction={() => setOpen(true)}
        />
      ) : (
        <div className="space-y-2">
          {store.expenses.map((e) => (
            <Card key={e.id} className="flex items-center justify-between !p-4">
              <div>
                <p className="font-medium text-surface-900 dark:text-surface-50">{e.name}</p>
                <p className="text-xs text-surface-400">{EXPENSE_CATEGORY_LABELS[e.category]}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-semibold">
                  {formatCurrency(e.amount, currency)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => store.setExpenses(store.expenses.filter((x) => x.id !== e.id))}
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
        title="Add expense"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={add}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}
            options={Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <Input label="Label" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Optional" />
          <Input label="Monthly amount" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </div>
      </Modal>
    </div>
  )
}
