import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Modal, Input, Select, Checkbox } from '@/components/ui'
import { useFinanceStore } from '@/store/financeStore'
import {
  createId,
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
import { addMonthsIso, todayIso } from '@/lib/finance/interest'

export interface CreatePotDraft {
  name?: string
  purpose?: PotPurpose
  vehicle?: PotVehicle
  planMode?: PotPlanMode
  targetAmount?: number
  targetDate?: string
  currentAmount?: number
  monthlyAmount?: number
  expectedReturnPercent?: number
  swpYears?: number
  swpCorpus?: number
  /** When creating FD holding */
  fdPrincipal?: number
  fdInterestRate?: number
  fdStartDate?: string
  fdMaturityDate?: string
  /** When creating MF holding */
  mfInvestedAmount?: number
  mfCurrentValue?: number
  mfMonthlySip?: number
  /** Default for “also add holding” checkbox */
  createHoldingDefault?: boolean
}

interface CreatePotModalProps {
  open: boolean
  onClose: () => void
  draft?: CreatePotDraft
  title?: string
  /** Navigate to /goals after save (default true). */
  navigateToGoals?: boolean
}

export function CreatePotModal({
  open,
  onClose,
  draft,
  title = 'Create saving pot',
  navigateToGoals = true,
}: CreatePotModalProps) {
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [purpose, setPurpose] = useState<PotPurpose>('custom')
  const [vehicle, setVehicle] = useState<PotVehicle>('mf')
  const [planMode, setPlanMode] = useState<PotPlanMode>('accumulate')
  const [targetAmount, setTargetAmount] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [currentAmount, setCurrentAmount] = useState('')
  const [monthlyAmount, setMonthlyAmount] = useState('')
  const [expectedReturn, setExpectedReturn] = useState('')
  const [swpYears, setSwpYears] = useState('')
  const [swpCorpus, setSwpCorpus] = useState('')
  const [createHolding, setCreateHolding] = useState(true)

  useEffect(() => {
    if (!open) return
    const purposeInit = draft?.purpose ?? 'custom'
    const defaults = potDefaultsForPurpose(purposeInit)
    setPurpose(purposeInit)
    setName(draft?.name ?? defaults.name)
    setVehicle(draft?.vehicle ?? defaults.vehicle)
    setPlanMode(draft?.planMode ?? defaults.planMode)
    setTargetAmount(String(draft?.targetAmount ?? ''))
    setTargetDate(draft?.targetDate ?? '')
    setCurrentAmount(String(draft?.currentAmount ?? 0))
    setMonthlyAmount(String(draft?.monthlyAmount ?? 0))
    setExpectedReturn(
      String(draft?.expectedReturnPercent ?? defaults.expectedReturnPercent),
    )
    setSwpYears(String(draft?.swpYears ?? ''))
    setSwpCorpus(String(draft?.swpCorpus ?? draft?.currentAmount ?? ''))
    setCreateHolding(draft?.createHoldingDefault ?? true)
  }, [open, draft])

  const applyPurpose = (next: PotPurpose) => {
    const defaults = potDefaultsForPurpose(next)
    setPurpose(next)
    if (!draft?.name) setName(defaults.name)
    if (!draft?.vehicle) setVehicle(defaults.vehicle)
    if (!draft?.planMode) setPlanMode(defaults.planMode)
    if (draft?.expectedReturnPercent == null) {
      setExpectedReturn(String(defaults.expectedReturnPercent))
    }
  }

  const save = () => {
    const potId = createId()
    let linkedFixedDepositId: string | undefined
    let linkedMutualFundId: string | undefined

    const current = Number(currentAmount) || 0
    const monthly = Number(monthlyAmount) || 0
    const target = Number(targetAmount) || 0
    const rate = Number(expectedReturn) || 0
    const state = useFinanceStore.getState()

    if (createHolding && vehicle === 'fd') {
      const fdId = createId()
      const start = draft?.fdStartDate ?? todayIso()
      const maturity =
        draft?.fdMaturityDate ?? (targetDate || addMonthsIso(start, 36))
      const principal = draft?.fdPrincipal ?? (current > 0 ? current : target)
      state.setFixedDeposits([
        ...state.fixedDeposits,
        {
          id: fdId,
          name: name || 'Fixed deposit',
          principal,
          interestRate: draft?.fdInterestRate ?? rate,
          startDate: start,
          maturityDate: maturity,
        },
      ])
      linkedFixedDepositId = fdId
    }

    if (createHolding && vehicle === 'mf') {
      const mfId = createId()
      const latest = useFinanceStore.getState()
      const corpus =
        draft?.mfCurrentValue ??
        (planMode === 'withdraw'
          ? Number(swpCorpus) || current || target
          : current)
      const invested = draft?.mfInvestedAmount ?? corpus
      const sip =
        draft?.mfMonthlySip ?? (planMode === 'accumulate' ? monthly : 0)
      latest.setMutualFunds([
        ...latest.mutualFunds,
        {
          id: mfId,
          name: name || 'Mutual fund',
          investedAmount: invested,
          currentValue: corpus,
          monthlySip: sip,
          fundCategory: 'equity',
        },
      ])
      linkedMutualFundId = mfId
    }

    const pot: SavingPot = {
      id: potId,
      name: name.trim() || 'Saving pot',
      purpose,
      vehicle,
      targetAmount: target,
      targetDate: targetDate || undefined,
      currentAmount: current,
      monthlyAmount: monthly,
      expectedReturnPercent: rate,
      planMode,
      swpYears: planMode === 'withdraw' && swpYears ? Number(swpYears) : undefined,
      swpCorpus:
        planMode === 'withdraw' && swpCorpus ? Number(swpCorpus) : undefined,
      linkedFixedDepositId,
      linkedMutualFundId,
    }

    const latest = useFinanceStore.getState()
    latest.setSavingPots([...(latest.savingPots ?? []), pot])
    onClose()
    if (navigateToGoals) navigate('/goals')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!name.trim()}>
            Create pot
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Select
          label="Purpose"
          value={purpose}
          onChange={(e) => applyPurpose(e.target.value as PotPurpose)}
          options={POT_PURPOSE_OPTIONS.map((p) => ({
            value: p,
            label: POT_PURPOSE_LABELS[p],
          }))}
        />
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
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
        <Checkbox
          label={
            vehicle === 'fd'
              ? 'Also add Fixed Deposit under Investments'
              : 'Also add Mutual Fund under Investments'
          }
          checked={createHolding}
          onChange={setCreateHolding}
        />
      </div>
    </Modal>
  )
}
