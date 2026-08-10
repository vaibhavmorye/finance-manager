import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, RefreshCw, Calculator } from 'lucide-react'
import {
  Button,
  Card,
  Badge,
  EmptyState,
  Modal,
  Input,
  Select,
} from '@/components/ui'
import { CreatePotModal, type CreatePotDraft } from '@/components/CreatePotModal'
import { useFinanceStore } from '@/store/financeStore'
import { formatCurrency } from '@/lib/utils'
import {
  potDefaultsForPurpose,
  POT_PURPOSE_LABELS,
  POT_PURPOSE_OPTIONS,
  POT_VEHICLE_LABELS,
  POT_VEHICLE_OPTIONS,
  POT_PLAN_MODE_LABELS,
  POT_PLAN_MODE_OPTIONS,
  type PotPurpose,
  type PotVehicle,
  type PotPlanMode,
  type SavingPot,
} from '@/types/finance'

const PURPOSE_BADGE: Record<PotPurpose, 'success' | 'info' | 'warning' | 'default'> = {
  emergency: 'warning',
  education: 'info',
  retirement: 'success',
  custom: 'default',
}

export function GoalsPage() {
  const store = useFinanceStore()
  const currency = store.profile.currency
  const pots = store.savingPots ?? []

  const [createOpen, setCreateOpen] = useState(false)
  const [createDraft, setCreateDraft] = useState<CreatePotDraft | undefined>()
  const [editId, setEditId] = useState<string | null>(null)

  const editing = pots.find((p) => p.id === editId) ?? null

  const openTemplate = (purpose: PotPurpose) => {
    const defaults = potDefaultsForPurpose(purpose)
    setCreateDraft({
      purpose,
      name: defaults.name,
      vehicle: defaults.vehicle,
      planMode: defaults.planMode,
      expectedReturnPercent: defaults.expectedReturnPercent,
      currentAmount: 0,
      monthlyAmount: 0,
      targetAmount: purpose === 'emergency' ? 600_000 : purpose === 'education' ? 25_00_000 : 2_00_00_000,
      createHoldingDefault: false,
    })
    setCreateOpen(true)
  }

  const syncFromHolding = (pot: SavingPot) => {
    let amount = pot.currentAmount
    if (pot.linkedFixedDepositId) {
      const fd = store.fixedDeposits.find((f) => f.id === pot.linkedFixedDepositId)
      if (fd) amount = fd.principal
    }
    if (pot.linkedMutualFundId) {
      const mf = store.mutualFunds.find((m) => m.id === pot.linkedMutualFundId)
      if (mf) amount = mf.currentValue
    }
    store.setSavingPots(
      pots.map((p) => (p.id === pot.id ? { ...p, currentAmount: amount } : p)),
    )
  }

  const calculatorLink = (pot: SavingPot) => {
    if (pot.vehicle === 'fd') return '/calculators/interest'
    if (pot.planMode === 'withdraw') return '/calculators/swp'
    return '/calculators/sip'
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50">Goals</h1>
          <p className="text-sm text-surface-500">
            Goal-based saving pots for emergency, education, retirement, and more
          </p>
        </div>
        <Button
          onClick={() => {
            setCreateDraft(undefined)
            setCreateOpen(true)
          }}
        >
          <Plus className="h-4 w-4" /> Add pot
        </Button>
      </div>

      {pots.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            title="No saving pots yet"
            description="Start from a template, or create a pot from the Interest or SWP calculators."
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {POT_PURPOSE_OPTIONS.map((purpose) => {
              const d = potDefaultsForPurpose(purpose)
              return (
                <button
                  key={purpose}
                  type="button"
                  onClick={() => openTemplate(purpose)}
                  className="rounded-2xl border border-surface-200 bg-white p-4 text-left transition hover:border-brand-300 hover:shadow-md dark:border-surface-700 dark:bg-surface-900 dark:hover:border-brand-700"
                >
                  <p className="font-semibold text-surface-900 dark:text-surface-50">
                    {POT_PURPOSE_LABELS[purpose]}
                  </p>
                  <p className="mt-1 text-xs text-surface-500">
                    {POT_VEHICLE_LABELS[d.vehicle]} · {POT_PLAN_MODE_LABELS[d.planMode]}
                  </p>
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {pots.map((pot) => {
            const progress =
              pot.targetAmount > 0
                ? Math.min(100, Math.round((pot.currentAmount / pot.targetAmount) * 100))
                : 0
            return (
              <Card key={pot.id} className="!p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-surface-900 dark:text-surface-50">
                        {pot.name}
                      </p>
                      <Badge variant={PURPOSE_BADGE[pot.purpose]}>
                        {POT_PURPOSE_LABELS[pot.purpose]}
                      </Badge>
                      <Badge variant="default">{POT_VEHICLE_LABELS[pot.vehicle]}</Badge>
                      <Badge variant="info">{POT_PLAN_MODE_LABELS[pot.planMode]}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-surface-400">
                      {formatCurrency(pot.currentAmount, currency, { compact: true })} of{' '}
                      {formatCurrency(pot.targetAmount, currency, { compact: true })}
                      {pot.targetDate ? ` · target ${pot.targetDate}` : ''}
                      {pot.monthlyAmount > 0
                        ? ` · ${formatCurrency(pot.monthlyAmount, currency)}/mo ${
                            pot.planMode === 'withdraw' ? 'SWP' : 'SIP'
                          }`
                        : ''}
                    </p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800">
                      <div
                        className="h-full rounded-full bg-brand-500 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-surface-400">{progress}% funded</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => syncFromHolding(pot)}
                      disabled={!pot.linkedFixedDepositId && !pot.linkedMutualFundId}
                      title="Sync current amount from linked holding"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Sync
                    </Button>
                    <Link to={calculatorLink(pot)}>
                      <Button variant="outline" size="sm">
                        <Calculator className="h-3.5 w-3.5" /> Calc
                      </Button>
                    </Link>
                    {pot.linkedMutualFundId && (
                      <Link to="/investments">
                        <Button variant="ghost" size="sm">
                          MF
                        </Button>
                      </Link>
                    )}
                    {pot.linkedFixedDepositId && (
                      <Link to="/investments">
                        <Button variant="ghost" size="sm">
                          FD
                        </Button>
                      </Link>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Edit"
                      onClick={() => setEditId(pot.id)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Delete"
                      onClick={() =>
                        store.setSavingPots(pots.filter((p) => p.id !== pot.id))
                      }
                    >
                      <Trash2 className="h-4 w-4 text-accent-rose" />
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {POT_PURPOSE_OPTIONS.map((purpose) => (
              <button
                key={purpose}
                type="button"
                onClick={() => openTemplate(purpose)}
                className="rounded-xl border border-dashed border-surface-300 px-3 py-2 text-left text-sm text-surface-500 hover:border-brand-400 hover:text-brand-600 dark:border-surface-600"
              >
                + {POT_PURPOSE_LABELS[purpose]}
              </button>
            ))}
          </div>
        </div>
      )}

      <CreatePotModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        draft={createDraft}
        navigateToGoals={false}
      />

      {editing && (
        <EditPotModal
          pot={editing}
          onClose={() => setEditId(null)}
          onSave={(updated) => {
            store.setSavingPots(pots.map((p) => (p.id === updated.id ? updated : p)))
            setEditId(null)
          }}
        />
      )}
    </div>
  )
}

function EditPotModal({
  pot,
  onClose,
  onSave,
}: {
  pot: SavingPot
  onClose: () => void
  onSave: (pot: SavingPot) => void
}) {
  const [name, setName] = useState(pot.name)
  const [purpose, setPurpose] = useState(pot.purpose)
  const [vehicle, setVehicle] = useState(pot.vehicle)
  const [planMode, setPlanMode] = useState(pot.planMode)
  const [targetAmount, setTargetAmount] = useState(String(pot.targetAmount))
  const [targetDate, setTargetDate] = useState(pot.targetDate ?? '')
  const [currentAmount, setCurrentAmount] = useState(String(pot.currentAmount))
  const [monthlyAmount, setMonthlyAmount] = useState(String(pot.monthlyAmount))
  const [expectedReturn, setExpectedReturn] = useState(String(pot.expectedReturnPercent))
  const [swpYears, setSwpYears] = useState(String(pot.swpYears ?? ''))
  const [swpCorpus, setSwpCorpus] = useState(String(pot.swpCorpus ?? ''))

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit pot"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSave({
                ...pot,
                name: name.trim() || pot.name,
                purpose,
                vehicle,
                planMode,
                targetAmount: Number(targetAmount) || 0,
                targetDate: targetDate || undefined,
                currentAmount: Number(currentAmount) || 0,
                monthlyAmount: Number(monthlyAmount) || 0,
                expectedReturnPercent: Number(expectedReturn) || 0,
                swpYears: planMode === 'withdraw' && swpYears ? Number(swpYears) : undefined,
                swpCorpus: planMode === 'withdraw' && swpCorpus ? Number(swpCorpus) : undefined,
              })
            }
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Select
          label="Purpose"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value as PotPurpose)}
          options={POT_PURPOSE_OPTIONS.map((p) => ({
            value: p,
            label: POT_PURPOSE_LABELS[p],
          }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Vehicle"
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value as PotVehicle)}
            options={POT_VEHICLE_OPTIONS.map((v) => ({
              value: v,
              label: POT_VEHICLE_LABELS[v],
            }))}
          />
          <Select
            label="Plan"
            value={planMode}
            onChange={(e) => setPlanMode(e.target.value as PotPlanMode)}
            options={POT_PLAN_MODE_OPTIONS.map((m) => ({
              value: m,
              label: POT_PLAN_MODE_LABELS[m],
            }))}
          />
        </div>
        <Input
          label="Target amount"
          type="number"
          value={targetAmount}
          onChange={(e) => setTargetAmount(e.target.value)}
        />
        <Input
          label="Target date"
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
        />
        <Input
          label="Current amount"
          type="number"
          value={currentAmount}
          onChange={(e) => setCurrentAmount(e.target.value)}
        />
        <Input
          label={planMode === 'withdraw' ? 'Monthly withdrawal' : 'Monthly contribution'}
          type="number"
          value={monthlyAmount}
          onChange={(e) => setMonthlyAmount(e.target.value)}
        />
        <Input
          label="Expected return %"
          type="number"
          value={expectedReturn}
          onChange={(e) => setExpectedReturn(e.target.value)}
        />
        {planMode === 'withdraw' && (
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="SWP years"
              type="number"
              value={swpYears}
              onChange={(e) => setSwpYears(e.target.value)}
            />
            <Input
              label="SWP corpus"
              type="number"
              value={swpCorpus}
              onChange={(e) => setSwpCorpus(e.target.value)}
            />
          </div>
        )}
      </div>
    </Modal>
  )
}
