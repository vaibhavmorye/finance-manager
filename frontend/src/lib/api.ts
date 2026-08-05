import type { FinanceData } from '@/types/finance'

/** Storage mode: `local` (browser) or `api` (backend). Set via VITE_STORAGE_MODE. */
export type StorageMode = 'local' | 'api'

const rawMode = (import.meta.env.VITE_STORAGE_MODE as string | undefined)?.toLowerCase()
const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || undefined

/**
 * Explicit flag wins. If unset, fall back to API mode when VITE_API_URL is present
 * so older env files keep working.
 */
export function getStorageMode(): StorageMode {
  if (rawMode === 'api' || rawMode === 'local') return rawMode
  return API_URL ? 'api' : 'local'
}

export function isApiMode(): boolean {
  return getStorageMode() === 'api'
}

export function getApiUrl(): string | undefined {
  return API_URL
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('fm-token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  if (!API_URL) throw new Error('VITE_API_URL is required when VITE_STORAGE_MODE=api')
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...options?.headers },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body.error || `Request failed (${res.status})`)
  }
  return body as T
}

export async function signup(email: string, password: string) {
  const data = await request<{ token: string; user: { id: string; email: string } }>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  localStorage.setItem('fm-token', data.token)
  localStorage.setItem('fm-user', JSON.stringify(data.user))
  return data
}

export async function login(email: string, password: string) {
  const data = await request<{ token: string; user: { id: string; email: string } }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  localStorage.setItem('fm-token', data.token)
  localStorage.setItem('fm-user', JSON.stringify(data.user))
  return data
}

export function logout() {
  localStorage.removeItem('fm-token')
  localStorage.removeItem('fm-user')
}

export function getStoredUser(): { id: string; email: string } | null {
  try {
    const raw = localStorage.getItem('fm-user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function hasToken(): boolean {
  return Boolean(localStorage.getItem('fm-token'))
}

export async function fetchSnapshot(): Promise<FinanceData> {
  return request<FinanceData>('/api/snapshot')
}

export async function saveSnapshot(data: FinanceData): Promise<void> {
  await request('/api/snapshot', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}
