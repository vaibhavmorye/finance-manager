import { describe, expect, it } from 'vitest'
import {
  decryptBackupJson,
  encryptBackupJson,
  isEncryptedBackup,
} from '@/lib/backupCrypto'

describe('backupCrypto', () => {
  it('encrypts and decrypts round-trip', async () => {
    const plaintext = JSON.stringify({ version: 1, hello: 'world' })
    const envelope = await encryptBackupJson(plaintext, 'correct-horse')
    expect(isEncryptedBackup(envelope)).toBe(true)
    expect(envelope.ciphertext).not.toContain('hello')
    const decrypted = await decryptBackupJson(envelope, 'correct-horse')
    expect(decrypted).toBe(plaintext)
  })

  it('rejects wrong password', async () => {
    const envelope = await encryptBackupJson('{"a":1}', 'right-password')
    await expect(decryptBackupJson(envelope, 'wrong-password')).rejects.toThrow(
      /Wrong password/,
    )
  })

  it('requires a non-empty password to encrypt', async () => {
    await expect(encryptBackupJson('{}', '')).rejects.toThrow(/Password is required/)
  })

  it('detects encrypted envelope shape', () => {
    expect(isEncryptedBackup({ format: 'finance-manager-encrypted' })).toBe(false)
    expect(
      isEncryptedBackup({
        format: 'finance-manager-encrypted',
        version: 1,
        kdf: 'PBKDF2',
        cipher: 'AES-GCM',
        iterations: 1000,
        salt: 'YQ==',
        iv: 'YQ==',
        ciphertext: 'YQ==',
      }),
    ).toBe(true)
    expect(isEncryptedBackup({ version: 1, profile: {} })).toBe(false)
  })
})
