/** Client-side backup encryption: PBKDF2 + AES-GCM (Web Crypto). */

export const ENCRYPTED_BACKUP_FORMAT = 'finance-manager-encrypted' as const

const PBKDF2_ITERATIONS = 310_000
const SALT_BYTES = 16
const IV_BYTES = 12

export interface EncryptedBackupEnvelope {
  format: typeof ENCRYPTED_BACKUP_FORMAT
  version: 1
  kdf: 'PBKDF2'
  cipher: 'AES-GCM'
  iterations: number
  salt: string
  iv: string
  ciphertext: string
}

export function isEncryptedBackup(value: unknown): value is EncryptedBackupEnvelope {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    v.format === ENCRYPTED_BACKUP_FORMAT &&
    v.version === 1 &&
    v.kdf === 'PBKDF2' &&
    v.cipher === 'AES-GCM' &&
    typeof v.iterations === 'number' &&
    typeof v.salt === 'string' &&
    typeof v.iv === 'string' &&
    typeof v.ciphertext === 'string'
  )
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function deriveAesKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptBackupJson(
  plaintextJson: string,
  password: string,
): Promise<EncryptedBackupEnvelope> {
  if (!password) throw new Error('Password is required to encrypt a backup.')

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await deriveAesKey(password, salt, PBKDF2_ITERATIONS)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintextJson),
  )

  return {
    format: ENCRYPTED_BACKUP_FORMAT,
    version: 1,
    kdf: 'PBKDF2',
    cipher: 'AES-GCM',
    iterations: PBKDF2_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  }
}

export async function decryptBackupJson(
  envelope: EncryptedBackupEnvelope,
  password: string,
): Promise<string> {
  if (!password) throw new Error('Password is required to decrypt this backup.')

  const salt = base64ToBytes(envelope.salt)
  const iv = base64ToBytes(envelope.iv)
  const ciphertext = base64ToBytes(envelope.ciphertext)
  const key = await deriveAesKey(password, salt, envelope.iterations)

  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext as BufferSource,
    )
    return new TextDecoder().decode(plaintext)
  } catch {
    throw new Error('Wrong password or corrupted backup file.')
  }
}
