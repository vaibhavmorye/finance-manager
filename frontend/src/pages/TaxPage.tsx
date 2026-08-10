import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Lightbulb } from 'lucide-react'
import {
  Badge,
  Card,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Select,
  StatCard,
} from '@/components/ui'
import { useFinanceStore } from '@/store/financeStore'
import { formatCurrency, cn } from '@/lib/utils'
import { compareIncomeTax, CAP_80C, CAP_80CCD1B, CAP_24B } from '@/lib/finance/tax'
import { formatFinancialYear } from '@/lib/finance/tradebook'
import { createDefaultTaxProfile, currentFyStartYear } from '@/types/finance'

function fyOptions(center: number): number[] {
  const years: number[] = []
  for (let y = center - 2; y <= center + 1; y++) years.push(y)
  return years
}

function RegimeColumn({
  title,
  recommended,
  total,
  taxable,
  slabTax,
  stcgTax,
  ltcgTax,
  cess,
  rebate,
  savingsLabel,
  currency,
}: {
  title: string
  recommended: boolean
  total: number
  taxable: number
  slabTax: number
  stcgTax: number
  ltcgTax: number
  cess: number
  rebate: number
  savingsLabel?: string
  currency: 'INR' | 'USD' | 'EUR' | 'GBP'
}) {
  return (
    <Card
      className={cn(
        'space-y-3',
        recommended && 'ring-2 ring-brand-500 dark:ring-brand-400',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-50">{title}</h3>
        {recommended && <Badge variant="success">Recommended</Badge>}
      </div>
      <p className="font-mono text-2xl font-bold text-surface-900 dark:text-surface-50">
        {formatCurrency(total, currency)}
      </p>
      {savingsLabel && <p className="text-xs text-brand-600 dark:text-brand-400">{savingsLabel}</p>}
      <dl className="space-y-1.5 text-sm">
        <Row label="Taxable income" value={formatCurrency(taxable, currency)} />
        <Row label="Slab tax" value={formatCurrency(slabTax, currency)} />
        {rebate > 0 && <Row label="§87A rebate" value={`−${formatCurrency(rebate, currency)}`} />}
        <Row label="STCG tax" value={formatCurrency(stcgTax, currency)} />
        <Row label="LTCG tax" value={formatCurrency(ltcgTax, currency)} />
        <Row label="Cess (4%)" value={formatCurrency(cess, currency)} />
      </dl>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-surface-600 dark:text-surface-300">
      <dt>{label}</dt>
      <dd className="font-mono text-surface-900 dark:text-surface-50">{value}</dd>
    </div>
  )
}

function CapBar({
  label,
  value,
  cap,
  currency,
}: {
  label: string
  value: number
  cap: number
  currency: 'INR' | 'USD' | 'EUR' | 'GBP'
}) {
  const pct = cap > 0 ? Math.min(100, (value / cap) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-surface-500">
        <span>{label}</span>
        <span className="font-mono">
          {formatCurrency(value, currency)} / {formatCurrency(cap, currency)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-200 dark:bg-surface-700">
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function TaxPage() {
  const store = useFinanceStore()
  const currency = store.profile.currency
  const taxProfile = store.taxProfile ?? createDefaultTaxProfile()
  const fy = taxProfile.fyStartYear || currentFyStartYear()

  const comparison = useMemo(() => compareIncomeTax(store, fy), [store, fy])
  const { old, new: neu, capitalGains, recommended, savings, tips } = comparison

  const setNum = (key: keyof typeof taxProfile, raw: string) => {
    store.setTaxProfile({ [key]: Number(raw) || 0 })
  }

  const winner = recommended === 'new' ? neu : old
  const loser = recommended === 'new' ? old : neu

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50">Income tax</h1>
          <p className="text-sm text-surface-500">
            Old vs new regime · FY 2025–26 slabs · equity & MF capital gains
          </p>
        </div>
        <Select
          label="Financial year"
          value={String(fy)}
          onChange={(e) => store.setTaxProfile({ fyStartYear: Number(e.target.value) })}
          options={fyOptions(currentFyStartYear()).map((y) => ({
            value: String(y),
            label: formatFinancialYear(y),
          }))}
          className="w-44"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Recommended tax"
          value={formatCurrency(winner.totalTax, currency)}
          sub={`${recommended === 'new' ? 'New' : 'Old'} regime · ${formatFinancialYear(fy)}`}
        />
        <StatCard
          label="You save"
          value={formatCurrency(savings, currency)}
          sub={`vs ${recommended === 'new' ? 'old' : 'new'} regime`}
        />
        <StatCard
          label="Gross salary (annual)"
          value={formatCurrency(winner.grossSalary, currency)}
          sub={
            store.salary.monthlyGross
              ? 'From Income → monthly gross × 12'
              : 'Set monthly gross on Income'
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RegimeColumn
          title="Old regime"
          recommended={recommended === 'old'}
          total={old.totalTax}
          taxable={old.taxableIncome}
          slabTax={old.slabTax}
          stcgTax={old.stcgTax}
          ltcgTax={old.ltcgTax}
          cess={old.cess}
          rebate={old.rebate87A}
          savingsLabel={
            recommended === 'old' && savings > 0
              ? `Saves ${formatCurrency(savings, currency)} vs new`
              : undefined
          }
          currency={currency}
        />
        <RegimeColumn
          title="New regime"
          recommended={recommended === 'new'}
          total={neu.totalTax}
          taxable={neu.taxableIncome}
          slabTax={neu.slabTax}
          stcgTax={neu.stcgTax}
          ltcgTax={neu.ltcgTax}
          cess={neu.cess}
          rebate={neu.rebate87A}
          savingsLabel={
            recommended === 'new' && savings > 0
              ? `Saves ${formatCurrency(savings, currency)} vs old`
              : undefined
          }
          currency={currency}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <CardHeader>
            <CardTitle>Income build-up</CardTitle>
          </CardHeader>
          <dl className="space-y-2 text-sm">
            <Row label="Gross salary" value={formatCurrency(winner.grossSalary, currency)} />
            <Row label="Other income" value={formatCurrency(winner.otherIncome, currency)} />
            <Row
              label="Debt MF → slabs"
              value={formatCurrency(capitalGains.debtSlabGains, currency)}
            />
            <Row
              label={`Std deduction (${recommended})`}
              value={`−${formatCurrency(winner.standardDeduction, currency)}`}
            />
            {recommended === 'old' && (
              <>
                <Row label="HRA exemption" value={`−${formatCurrency(old.hraExemption, currency)}`} />
                <Row label="80C / 80D / NPS / 24(b)" value={`−${formatCurrency(old.section80C + old.section80D + old.section80CCD1B + old.section24b, currency)}`} />
              </>
            )}
            <Row label="Taxable (slab)" value={formatCurrency(winner.taxableIncome, currency)} />
          </dl>
          {!store.salary.monthlyGross && (
            <p className="text-xs text-surface-500">
              <Link to="/income" className="text-brand-600 hover:underline">
                Add monthly gross on Income
              </Link>{' '}
              for an accurate salary tax figure.
            </p>
          )}
        </Card>

        <Card className="space-y-4">
          <CardHeader>
            <CardTitle>Optimize</CardTitle>
          </CardHeader>
          <ul className="space-y-3">
            {tips.map((tip) => (
              <li key={tip.id} className="flex gap-2 text-sm text-surface-700 dark:text-surface-200">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                <span>{tip.message}</span>
              </li>
            ))}
          </ul>
          {savings > 0 && (
            <p className="text-xs text-surface-500">
              Choosing {recommended === 'new' ? 'new' : 'old'} over the other cuts liability by{' '}
              {formatCurrency(loser.totalTax - winner.totalTax, currency)}.
            </p>
          )}
        </Card>
      </div>

      <Card className="space-y-4">
        <CardHeader>
          <CardTitle>Deductions (old regime)</CardTitle>
        </CardHeader>
        <p className="text-xs text-surface-500">
          These reduce taxable income only under the old regime. New regime ignores them (except
          standard deduction).
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Section 80C"
            type="number"
            value={taxProfile.section80C || ''}
            onChange={(e) => setNum('section80C', e.target.value)}
            placeholder="150000"
          />
          <Input
            label="Section 80D (health)"
            type="number"
            value={taxProfile.section80D || ''}
            onChange={(e) => setNum('section80D', e.target.value)}
            placeholder="25000"
          />
          <Input
            label="Section 80CCD(1B) NPS"
            type="number"
            value={taxProfile.section80CCD1B || ''}
            onChange={(e) => setNum('section80CCD1B', e.target.value)}
            placeholder="50000"
          />
          <Input
            label="Section 24(b) home-loan interest"
            type="number"
            value={taxProfile.section24b || ''}
            onChange={(e) => setNum('section24b', e.target.value)}
            placeholder="200000"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <CapBar label="80C" value={taxProfile.section80C} cap={CAP_80C} currency={currency} />
          <CapBar
            label="80CCD(1B)"
            value={taxProfile.section80CCD1B}
            cap={CAP_80CCD1B}
            currency={currency}
          />
          <CapBar label="24(b)" value={taxProfile.section24b} cap={CAP_24B} currency={currency} />
        </div>

        <div className="border-t border-surface-200 pt-4 dark:border-surface-700">
          <p className="mb-3 text-sm font-medium text-surface-700 dark:text-surface-300">
            HRA exemption inputs (annual)
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Basic salary"
              type="number"
              value={taxProfile.basicSalaryAnnual || ''}
              onChange={(e) => setNum('basicSalaryAnnual', e.target.value)}
            />
            <Input
              label="HRA received"
              type="number"
              value={taxProfile.hraReceivedAnnual || ''}
              onChange={(e) => setNum('hraReceivedAnnual', e.target.value)}
            />
            <Input
              label="Rent paid"
              type="number"
              value={taxProfile.rentPaidAnnual || ''}
              onChange={(e) => setNum('rentPaidAnnual', e.target.value)}
            />
            <Checkbox
              label="Metro city"
              description="50% of basic vs 40% for non-metro"
              checked={taxProfile.isMetro}
              onChange={(checked) => store.setTaxProfile({ isMetro: checked })}
            />
          </div>
          <p className="mt-2 text-xs text-surface-500">
            Computed HRA exemption: {formatCurrency(old.hraExemption, currency)}
          </p>
        </div>
      </Card>

      <Card className="space-y-4">
        <CardHeader>
          <CardTitle>Capital gains · {formatFinancialYear(fy)}</CardTitle>
        </CardHeader>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Equity STCG"
            value={formatCurrency(capitalGains.equityStcg, currency)}
            sub="Stocks + equity MF · 20%"
          />
          <StatCard
            label="Equity LTCG"
            value={formatCurrency(capitalGains.equityLtcg, currency)}
            sub={`Exempt used ${formatCurrency(capitalGains.ltcgExemptionUsed, currency)}`}
          />
          <StatCard
            label="Taxable LTCG"
            value={formatCurrency(capitalGains.equityLtcgTaxable, currency)}
            sub="After ₹1.25L §112A"
          />
          <StatCard
            label="Debt MF (slabs)"
            value={formatCurrency(capitalGains.debtSlabGains, currency)}
            sub="Added to slab income"
          />
        </div>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <Row label="Stock STCG" value={formatCurrency(capitalGains.stockStcg, currency)} />
          <Row label="Stock LTCG" value={formatCurrency(capitalGains.stockLtcg, currency)} />
          <Row label="Equity MF STCG" value={formatCurrency(capitalGains.mfEquityStcg, currency)} />
          <Row label="Equity MF LTCG" value={formatCurrency(capitalGains.mfEquityLtcg, currency)} />
        </dl>
        {capitalGains.rows.length === 0 && (
          <p className="text-sm text-surface-500">
            No realized gains this FY.{' '}
            <Link to="/investments" className="text-brand-600 hover:underline">
              Import a stock tradebook
            </Link>{' '}
            or add MF lots on Investments.
          </p>
        )}
      </Card>
    </div>
  )
}
