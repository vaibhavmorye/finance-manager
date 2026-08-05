import type { FinanceData } from '@/types/finance'
import { createDefaultData } from '@/types/finance'
import { financeDataSchema } from '@/lib/schemas'

const STORAGE_KEY = 'finance-manager-data'

export function loadFromLocalStorage(): FinanceData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createDefaultData()
    const parsed = JSON.parse(raw)
    const result = financeDataSchema.safeParse(parsed)
    if (result.success) return result.data
    return createDefaultData()
  } catch {
    return createDefaultData()
  }
}

export function saveToLocalStorage(data: FinanceData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function clearLocalStorage(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function exportToJsonFile(data: FinanceData, filename?: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename ?? `finance-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importFromJsonFile(file: File): Promise<FinanceData> {
  const text = await file.text()
  const parsed = JSON.parse(text)
  const result = financeDataSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error('Invalid finance data file. Please use a valid export.')
  }
  return result.data
}
