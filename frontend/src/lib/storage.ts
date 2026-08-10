import type { FinanceData } from '@/types/finance'
import { createDefaultData } from '@/types/finance'
import { financeDataSchema } from '@/lib/schemas'
import {
  decryptBackupJson,
  encryptBackupJson,
  isEncryptedBackup,
} from '@/lib/backupCrypto'

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

function downloadJsonBlob(payload: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Export an AES-GCM encrypted backup. Password is required. */
export async function exportToJsonFile(
  data: FinanceData,
  password: string,
  filename?: string,
): Promise<void> {
  const envelope = await encryptBackupJson(JSON.stringify(data), password)
  downloadJsonBlob(
    envelope,
    filename ?? `finance-backup-${new Date().toISOString().slice(0, 10)}.json`,
  )
}

export type BackupFileKind = 'encrypted' | 'plain' | 'invalid'

/** Peek at a backup file to decide whether a password is needed. */
export async function peekBackupFile(file: File): Promise<BackupFileKind> {
  try {
    const parsed: unknown = JSON.parse(await file.text())
    if (isEncryptedBackup(parsed)) return 'encrypted'
    const result = financeDataSchema.safeParse(parsed)
    return result.success ? 'plain' : 'invalid'
  } catch {
    return 'invalid'
  }
}

/**
 * Import a backup file.
 * Encrypted backups require `password`. Plain JSON (legacy) imports without one.
 */
export async function importFromJsonFile(file: File, password?: string): Promise<FinanceData> {
  const text = await file.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Invalid finance data file. Please use a valid export.')
  }

  if (isEncryptedBackup(parsed)) {
    if (!password) {
      throw new Error('This backup is encrypted. Enter the password to import.')
    }
    const plaintext = await decryptBackupJson(parsed, password)
    try {
      parsed = JSON.parse(plaintext)
    } catch {
      throw new Error('Decrypted backup is not valid JSON.')
    }
  }

  const result = financeDataSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error('Invalid finance data file. Please use a valid export.')
  }
  return result.data
}
