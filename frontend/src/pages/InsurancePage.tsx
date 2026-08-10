import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button, Card, Input, Select, EmptyState, Modal, Badge, Checkbox } from '@/components/ui'
import { useFinanceStore } from '@/store/financeStore'
import { formatCurrency } from '@/lib/utils'
import {
  createId,
  COVERED_PERSON_LABELS,
  COVERED_PERSON_OPTIONS,
  INSURANCE_TYPE_LABELS,
  type CoveredPerson,
  type InsuranceType,
  type PremiumFrequency,
} from '@/types/finance'
import { monthlyInsurancePremium } from '@/lib/finance/networth'

const emptyForm = {
  provider: '',
  type: 'health' as InsuranceType,
  coverAmount: '',
  premium: '',
  frequency: 'yearly' as PremiumFrequency,
  renewalDate: new Date().toISOString().slice(0, 10),
  peopleCovered: [] as CoveredPerson[],
}

export function InsurancePage() {
  const store = useFinanceStore()
  const currency = store.profile.currency
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const togglePerson = (person: CoveredPerson, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      peopleCovered: checked
        ? [...prev.peopleCovered, person]
        : prev.peopleCovered.filter((p) => p !== person),
    }))
  }

  const add = () => {
    if (!form.provider || !form.premium) return
    store.setHealthInsurance([
      ...store.healthInsurance,
      {
        id: createId(),
        provider: form.provider,
        type: form.type,
        coverAmount: Number(form.coverAmount) || 0,
        premium: Number(form.premium),
        frequency: form.frequency,
        renewalDate: form.renewalDate,
        peopleCovered: form.peopleCovered,
      },
    ])
    setForm({ ...emptyForm, renewalDate: new Date().toISOString().slice(0, 10) })
    setOpen(false)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50">Insurance</h1>
          <p className="text-sm text-surface-500">
            Health & term policies · Monthly cost ~{' '}
            {formatCurrency(monthlyInsurancePremium(store), currency)}
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Add policy
        </Button>
      </div>

      {store.healthInsurance.length === 0 ? (
        <EmptyState
          title="No policies yet"
          description="Track health and term cover, people covered, premiums and renewals."
          actionLabel="Add policy"
          onAction={() => setOpen(true)}
        />
      ) : (
        <div className="space-y-3">
          {store.healthInsurance.map((p) => (
            <Card key={p.id} className="!p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-surface-900 dark:text-surface-50">{p.provider}</h3>
                    <Badge variant={p.type === 'term' ? 'warning' : 'success'}>
                      {INSURANCE_TYPE_LABELS[p.type ?? 'health']}
                    </Badge>
                    <Badge variant="info">{p.frequency}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-surface-500">Renews {p.renewalDate}</p>
                  {(p.peopleCovered?.length ?? 0) > 0 && (
                    <p className="mt-1 text-sm text-surface-600 dark:text-surface-400">
                      Covers{' '}
                      {p.peopleCovered
                        .map((person) => COVERED_PERSON_LABELS[person])
                        .join(', ')}
                    </p>
                  )}
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
                  <p className="text-xs text-surface-400">
                    {p.type === 'term' ? 'Sum assured' : 'Cover'}
                  </p>
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
        title="Add insurance policy"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={add}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Type"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as InsuranceType })}
            options={[
              { value: 'health', label: 'Health insurance' },
              { value: 'term', label: 'Term insurance' },
            ]}
          />
          <Input
            label="Provider"
            value={form.provider}
            onChange={(e) => setForm({ ...form, provider: e.target.value })}
          />
          <Input
            label={form.type === 'term' ? 'Sum assured' : 'Cover amount'}
            type="number"
            value={form.coverAmount}
            onChange={(e) => setForm({ ...form, coverAmount: e.target.value })}
          />
          <Input
            label="Premium"
            type="number"
            value={form.premium}
            onChange={(e) => setForm({ ...form, premium: e.target.value })}
          />
          <Select
            label="Frequency"
            value={form.frequency}
            onChange={(e) => setForm({ ...form, frequency: e.target.value as PremiumFrequency })}
            options={[
              { value: 'yearly', label: 'Yearly' },
              { value: 'monthly', label: 'Monthly' },
            ]}
          />
          <Input
            label="Renewal date"
            type="date"
            value={form.renewalDate}
            onChange={(e) => setForm({ ...form, renewalDate: e.target.value })}
          />
          <div>
            <p className="mb-2 text-sm font-medium text-surface-700 dark:text-surface-200">
              People covered
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {COVERED_PERSON_OPTIONS.map((person) => (
                <Checkbox
                  key={person}
                  label={COVERED_PERSON_LABELS[person]}
                  checked={form.peopleCovered.includes(person)}
                  onChange={(checked) => togglePerson(person, checked)}
                />
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
