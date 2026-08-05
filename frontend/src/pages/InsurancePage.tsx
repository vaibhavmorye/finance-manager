import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button, Card, Input, Select, EmptyState, Modal, Badge } from '@/components/ui'
import { useFinanceStore } from '@/store/financeStore'
import { formatCurrency } from '@/lib/utils'
import { createId, type PremiumFrequency } from '@/types/finance'
import { monthlyInsurancePremium } from '@/lib/finance/networth'

export function InsurancePage() {
  const store = useFinanceStore()
  const currency = store.profile.currency
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    provider: '',
    coverAmount: '',
    premium: '',
    frequency: 'yearly' as PremiumFrequency,
    renewalDate: new Date().toISOString().slice(0, 10),
  })

  const add = () => {
    if (!form.provider || !form.premium) return
    store.setHealthInsurance([
      ...store.healthInsurance,
      {
        id: createId(),
        provider: form.provider,
        coverAmount: Number(form.coverAmount) || 0,
        premium: Number(form.premium),
        frequency: form.frequency,
        renewalDate: form.renewalDate,
      },
    ])
    setOpen(false)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50">Health insurance</h1>
          <p className="text-sm text-surface-500">
            Monthly cost ~ {formatCurrency(monthlyInsurancePremium(store), currency)}
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Add policy
        </Button>
      </div>

      {store.healthInsurance.length === 0 ? (
        <EmptyState
          title="No policies yet"
          description="Track cover amount, premiums and renewal dates."
          actionLabel="Add policy"
          onAction={() => setOpen(true)}
        />
      ) : (
        <div className="space-y-3">
          {store.healthInsurance.map((p) => (
            <Card key={p.id} className="!p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-surface-900 dark:text-surface-50">{p.provider}</h3>
                    <Badge variant="info">{p.frequency}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-surface-500">Renews {p.renewalDate}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    store.setHealthInsurance(store.healthInsurance.filter((x) => x.id !== p.id))
                  }
                >
                  <Trash2 className="h-4 w-4 text-accent-rose" />
                </Button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-surface-50 px-3 py-2 dark:bg-surface-800/50">
                  <p className="text-xs text-surface-400">Cover</p>
                  <p className="font-mono text-sm font-semibold">
                    {formatCurrency(p.coverAmount, currency, { compact: true })}
                  </p>
                </div>
                <div className="rounded-xl bg-surface-50 px-3 py-2 dark:bg-surface-800/50">
                  <p className="text-xs text-surface-400">Premium</p>
                  <p className="font-mono text-sm font-semibold">
                    {formatCurrency(p.premium, currency)}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add health insurance"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={add}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Provider" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} />
          <Input label="Cover amount" type="number" value={form.coverAmount} onChange={(e) => setForm({ ...form, coverAmount: e.target.value })} />
          <Input label="Premium" type="number" value={form.premium} onChange={(e) => setForm({ ...form, premium: e.target.value })} />
          <Select
            label="Frequency"
            value={form.frequency}
            onChange={(e) => setForm({ ...form, frequency: e.target.value as PremiumFrequency })}
            options={[
              { value: 'yearly', label: 'Yearly' },
              { value: 'monthly', label: 'Monthly' },
            ]}
          />
          <Input label="Renewal date" type="date" value={form.renewalDate} onChange={(e) => setForm({ ...form, renewalDate: e.target.value })} />
        </div>
      </Modal>
    </div>
  )
}
