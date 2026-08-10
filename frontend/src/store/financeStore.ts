import { create } from 'zustand'
import type {
  FinanceData,
  Profile,
  Salary,
  OtherIncome,
  Stock,
  Trade,
  CorporateExitType,
  FixedDeposit,
  MutualFund,
  MfTransaction,
  OtherAsset,
  SavingPot,
  HomeLoan,
  OtherDebt,
  HealthInsurance,
  MonthlyExpense,
  ExpenseEntry,
  TaxProfile,
  AppSettings,
} from '@/types/finance'
import { createDefaultData, createDefaultTaxProfile } from '@/types/finance'
import {
  loadFromLocalStorage,
  saveToLocalStorage,
  clearLocalStorage,
  exportToJsonFile,
  importFromJsonFile,
} from '@/lib/storage'
import { isApiMode, fetchSnapshot, saveSnapshot, hasToken } from '@/lib/api'
import { analyzeTradebook, mergeTrades } from '@/lib/finance/tradebook'
import { mergeMfTransactions } from '@/lib/finance/mf-tradebook'
import { createDemoData } from '@/lib/demoData'

interface FinanceStore extends FinanceData {
  hydrated: boolean
  hydrate: () => void
  hydrateFromApi: () => Promise<void>
  resetAll: () => void
  importData: (file: File, password?: string) => Promise<void>
  /** Load sample Indian household data and mark onboarding complete. */
  loadDemoData: () => void
  /** Export encrypted JSON backup. Password is required. */
  exportData: (password: string) => Promise<void>
  setProfile: (profile: Partial<Profile>) => void
  setSalary: (salary: Salary) => void
  setOtherIncomes: (items: OtherIncome[]) => void
  setStocks: (items: Stock[]) => void
  setTrades: (items: Trade[]) => void
  /** Tag sell trades as a corporate exit (buyback, open offer, …) or clear the tag. */
  setTradeExitType: (tradeIds: string[], exitType: CorporateExitType | null) => void
  /** Merge tradebooks (dedupe) and rebuild stock positions + P&L */
  addTradesFromTradebook: (incoming: Trade[], opts?: { syncStocks?: boolean }) => {
    added: number
    skipped: number
    analysis: ReturnType<typeof analyzeTradebook>
  }
  clearTrades: () => void
  setFixedDeposits: (items: FixedDeposit[]) => void
  setMutualFunds: (items: MutualFund[]) => void
  setMfTransactions: (items: MfTransaction[]) => void
  addMfTransactions: (incoming: MfTransaction[]) => { added: number; skipped: number }
  setOtherAssets: (items: OtherAsset[]) => void
  setSavingPots: (items: SavingPot[]) => void
  setHomeLoans: (items: HomeLoan[]) => void
  setOtherDebts: (items: OtherDebt[]) => void
  setHealthInsurance: (items: HealthInsurance[]) => void
  setExpenses: (items: MonthlyExpense[]) => void
  setExpenseEntries: (items: ExpenseEntry[]) => void
  setTaxProfile: (profile: Partial<TaxProfile>) => void
  setSettings: (settings: Partial<AppSettings>) => void
  completeOnboarding: () => void
}

function normalizeLoaded(data: FinanceData): Partial<FinanceData> {
  return {
    ...data,
    salary: {
      monthlyGross: data.salary?.monthlyGross ?? 0,
      monthlyInHand: data.salary?.monthlyInHand ?? 0,
    },
    trades: data.trades ?? [],
    mfTransactions: data.mfTransactions ?? [],
    otherAssets: data.otherAssets ?? [],
    savingPots: data.savingPots ?? [],
    expenseEntries: data.expenseEntries ?? [],
    taxProfile: data.taxProfile ?? createDefaultTaxProfile(),
  }
}

function toData(get: () => FinanceStore): FinanceData {
  const state = get()
  return {
    version: 1,
    profile: state.profile,
    salary: state.salary,
    otherIncomes: state.otherIncomes,
    stocks: state.stocks,
    trades: state.trades ?? [],
    fixedDeposits: state.fixedDeposits,
    mutualFunds: state.mutualFunds,
    mfTransactions: state.mfTransactions ?? [],
    otherAssets: state.otherAssets ?? [],
    savingPots: state.savingPots ?? [],
    homeLoans: state.homeLoans,
    otherDebts: state.otherDebts,
    healthInsurance: state.healthInsurance,
    expenses: state.expenses,
    expenseEntries: state.expenseEntries ?? [],
    taxProfile: state.taxProfile ?? createDefaultTaxProfile(),
    settings: state.settings,
  }
}

function syncStocksFromTrades(trades: Trade[], existingStocks: Stock[]): Stock[] {
  // Prefer stored LTP overrides (manual edits / open-lot price updates)
  const overrides: Record<string, number> = {}
  for (const s of existingStocks) {
    const key = (s.ticker || s.name).toUpperCase()
    if (s.currentPrice > 0) overrides[key] = s.currentPrice
  }
  const analysis = analyzeTradebook(trades, overrides)
  const byTicker = new Map(
    existingStocks.map((s) => [(s.ticker || s.name).toUpperCase(), s] as const),
  )
  const fromLedger = analysis.positions.map((p) => {
    const key = (p.ticker || p.name).toUpperCase()
    const prev = byTicker.get(key)
    return {
      ...p,
      id: prev?.id ?? p.id,
      // analysis.positions already apply overrides; keep explicit store LTP when present
      currentPrice: prev?.currentPrice && prev.currentPrice > 0 ? prev.currentPrice : p.currentPrice,
      source: 'tradebook' as const,
    }
  })
  const ledgerKeys = new Set(fromLedger.map((p) => (p.ticker || p.name).toUpperCase()))
  const manuals = existingStocks
    .filter((s) => {
      const key = (s.ticker || s.name).toUpperCase()
      if (ledgerKeys.has(key)) return false
      // Keep explicit manuals and legacy untagged rows not covered by open positions
      return s.source !== 'tradebook'
    })
    .map((s) => ({ ...s, source: 'manual' as const }))

  return [...fromLedger, ...manuals]
}

let syncTimer: ReturnType<typeof setTimeout> | null = null

function persist(get: () => FinanceStore) {
  const data = toData(get)
  saveToLocalStorage(data)

  if (isApiMode() && hasToken()) {
    if (syncTimer) clearTimeout(syncTimer)
    syncTimer = setTimeout(() => {
      saveSnapshot(data).catch((err) => console.error('Failed to sync to API', err))
    }, 600)
  }
}

export const useFinanceStore = create<FinanceStore>((set, get) => ({
  ...createDefaultData(),
  hydrated: false,

  hydrate: () => {
    if (isApiMode()) {
      if (!hasToken()) {
        set({ ...createDefaultData(), hydrated: true })
        return
      }
      fetchSnapshot()
        .then((data) => set({ ...normalizeLoaded(data), hydrated: true }))
        .catch(() => set({ ...createDefaultData(), hydrated: true }))
      return
    }
    const data = loadFromLocalStorage()
    set({ ...normalizeLoaded(data), hydrated: true })
  },

  hydrateFromApi: async () => {
    const data = await fetchSnapshot()
    saveToLocalStorage(data)
    set({ ...normalizeLoaded(data), hydrated: true })
  },

  resetAll: () => {
    clearLocalStorage()
    const empty = createDefaultData()
    set({ ...empty, hydrated: true })
    if (isApiMode() && hasToken()) {
      saveSnapshot(empty).catch(console.error)
    }
  },

  importData: async (file: File, password?: string) => {
    const data = await importFromJsonFile(file, password)
    saveToLocalStorage(data)
    set({ ...normalizeLoaded(data), hydrated: true })
    if (isApiMode() && hasToken()) {
      await saveSnapshot(data)
    }
  },

  loadDemoData: () => {
    const data = createDemoData()
    saveToLocalStorage(data)
    set({ ...normalizeLoaded(data), hydrated: true })
    if (isApiMode() && hasToken()) {
      saveSnapshot(data).catch((err) => console.error('Failed to sync demo to API', err))
    }
  },

  exportData: async (password: string) => {
    await exportToJsonFile(toData(get), password)
  },

  setProfile: (profile) => {
    set((s) => ({ profile: { ...s.profile, ...profile } }))
    persist(get)
  },

  setSalary: (salary) => {
    set({
      salary: {
        monthlyGross: salary.monthlyGross ?? 0,
        monthlyInHand: salary.monthlyInHand ?? 0,
      },
    })
    persist(get)
  },

  setOtherIncomes: (otherIncomes) => {
    set({ otherIncomes })
    persist(get)
  },

  setStocks: (stocks) => {
    set({ stocks })
    persist(get)
  },

  setTrades: (trades) => {
    set({ trades })
    persist(get)
  },

  setTradeExitType: (tradeIds, exitType) => {
    const idSet = new Set(tradeIds.filter(Boolean))
    if (idSet.size === 0) return
    const trades = (get().trades ?? []).map((t) => {
      if (!idSet.has(t.tradeId) && !idSet.has(t.id)) return t
      if (t.tradeType !== 'sell') return t
      if (exitType == null) {
        const { exitType: _removed, ...rest } = t
        return rest
      }
      return { ...t, exitType }
    })
    set({ trades })
    persist(get)
  },

  addTradesFromTradebook: (incoming, opts) => {
    const sync = opts?.syncStocks !== false
    const { trades, added, skipped } = mergeTrades(get().trades ?? [], incoming)
    const stocks = sync ? syncStocksFromTrades(trades, get().stocks) : get().stocks
    const analysis = analyzeTradebook(trades)
    set({ trades, stocks })
    persist(get)
    return { added, skipped, analysis }
  },

  clearTrades: () => {
    set({ trades: [] })
    persist(get)
  },

  setFixedDeposits: (fixedDeposits) => {
    set({ fixedDeposits })
    persist(get)
  },

  setMutualFunds: (mutualFunds) => {
    set({ mutualFunds })
    persist(get)
  },

  setMfTransactions: (mfTransactions) => {
    set({ mfTransactions })
    persist(get)
  },

  addMfTransactions: (incoming) => {
    const { transactions, added, skipped } = mergeMfTransactions(
      get().mfTransactions ?? [],
      incoming,
    )
    set({ mfTransactions: transactions })
    persist(get)
    return { added, skipped }
  },

  setOtherAssets: (otherAssets) => {
    set({ otherAssets })
    persist(get)
  },

  setSavingPots: (savingPots) => {
    set({ savingPots })
    persist(get)
  },

  setHomeLoans: (homeLoans) => {
    set({ homeLoans })
    persist(get)
  },

  setOtherDebts: (otherDebts) => {
    set({ otherDebts })
    persist(get)
  },

  setHealthInsurance: (healthInsurance) => {
    set({ healthInsurance })
    persist(get)
  },

  setExpenses: (expenses) => {
    set({ expenses })
    persist(get)
  },

  setExpenseEntries: (expenseEntries) => {
    set({ expenseEntries })
    persist(get)
  },

  setTaxProfile: (profile) => {
    set((s) => ({
      taxProfile: { ...(s.taxProfile ?? createDefaultTaxProfile()), ...profile },
    }))
    persist(get)
  },

  setSettings: (settings) => {
    set((s) => ({ settings: { ...s.settings, ...settings } }))
    persist(get)
  },

  completeOnboarding: () => {
    set((s) => ({ profile: { ...s.profile, onboardingComplete: true } }))
    persist(get)
  },
}))
