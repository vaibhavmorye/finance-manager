import { create } from 'zustand'
import type {
  FinanceData,
  Profile,
  Salary,
  OtherIncome,
  Stock,
  FixedDeposit,
  MutualFund,
  HomeLoan,
  OtherDebt,
  HealthInsurance,
  MonthlyExpense,
  AppSettings,
} from '@/types/finance'
import { createDefaultData } from '@/types/finance'
import {
  loadFromLocalStorage,
  saveToLocalStorage,
  clearLocalStorage,
  exportToJsonFile,
  importFromJsonFile,
} from '@/lib/storage'
import { isApiMode, fetchSnapshot, saveSnapshot, hasToken } from '@/lib/api'

interface FinanceStore extends FinanceData {
  hydrated: boolean
  hydrate: () => void
  hydrateFromApi: () => Promise<void>
  resetAll: () => void
  importData: (file: File) => Promise<void>
  exportData: () => void
  setProfile: (profile: Partial<Profile>) => void
  setSalary: (salary: Salary) => void
  setOtherIncomes: (items: OtherIncome[]) => void
  setStocks: (items: Stock[]) => void
  setFixedDeposits: (items: FixedDeposit[]) => void
  setMutualFunds: (items: MutualFund[]) => void
  setHomeLoans: (items: HomeLoan[]) => void
  setOtherDebts: (items: OtherDebt[]) => void
  setHealthInsurance: (items: HealthInsurance[]) => void
  setExpenses: (items: MonthlyExpense[]) => void
  setSettings: (settings: Partial<AppSettings>) => void
  completeOnboarding: () => void
}

function toData(get: () => FinanceStore): FinanceData {
  const state = get()
  return {
    version: 1,
    profile: state.profile,
    salary: state.salary,
    otherIncomes: state.otherIncomes,
    stocks: state.stocks,
    fixedDeposits: state.fixedDeposits,
    mutualFunds: state.mutualFunds,
    homeLoans: state.homeLoans,
    otherDebts: state.otherDebts,
    healthInsurance: state.healthInsurance,
    expenses: state.expenses,
    settings: state.settings,
  }
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
      // Async hydrate — caller/App should also await hydrateFromApi
      fetchSnapshot()
        .then((data) => set({ ...data, hydrated: true }))
        .catch(() => set({ ...createDefaultData(), hydrated: true }))
      return
    }
    const data = loadFromLocalStorage()
    set({ ...data, hydrated: true })
  },

  hydrateFromApi: async () => {
    const data = await fetchSnapshot()
    saveToLocalStorage(data)
    set({ ...data, hydrated: true })
  },

  resetAll: () => {
    clearLocalStorage()
    const empty = createDefaultData()
    set({ ...empty, hydrated: true })
    if (isApiMode() && hasToken()) {
      saveSnapshot(empty).catch(console.error)
    }
  },

  importData: async (file: File) => {
    const data = await importFromJsonFile(file)
    saveToLocalStorage(data)
    set({ ...data, hydrated: true })
    if (isApiMode() && hasToken()) {
      await saveSnapshot(data)
    }
  },

  exportData: () => {
    exportToJsonFile(toData(get))
  },

  setProfile: (profile) => {
    set((s) => ({ profile: { ...s.profile, ...profile } }))
    persist(get)
  },

  setSalary: (salary) => {
    set({ salary })
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

  setFixedDeposits: (fixedDeposits) => {
    set({ fixedDeposits })
    persist(get)
  },

  setMutualFunds: (mutualFunds) => {
    set({ mutualFunds })
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

  setSettings: (settings) => {
    set((s) => ({ settings: { ...s.settings, ...settings } }))
    persist(get)
  },

  completeOnboarding: () => {
    set((s) => ({ profile: { ...s.profile, onboardingComplete: true } }))
    persist(get)
  },
}))
