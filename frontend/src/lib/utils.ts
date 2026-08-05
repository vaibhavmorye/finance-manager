import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Currency } from '@/types/finance'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const CURRENCY_LOCALE: Record<Currency, string> = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
}

export function formatCurrency(
  amount: number,
  currency: Currency = 'INR',
  options?: { compact?: boolean; decimals?: number },
): string {
  const { compact = false, decimals } = options ?? {}

  if (compact && currency === 'INR') {
    return formatIndianCompact(amount)
  }

  return new Intl.NumberFormat(CURRENCY_LOCALE[currency], {
    style: 'currency',
    currency,
    maximumFractionDigits: decimals ?? (Math.abs(amount) >= 100 ? 0 : 2),
    notation: compact && currency !== 'INR' ? 'compact' : 'standard',
  }).format(amount)
}

function formatIndianCompact(amount: number): string {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  if (abs >= 1_00_00_000) {
    return `${sign}₹${(abs / 1_00_00_000).toFixed(2)} Cr`
  }
  if (abs >= 1_00_000) {
    return `${sign}₹${(abs / 1_00_000).toFixed(2)} L`
  }
  if (abs >= 1_000) {
    return `${sign}₹${(abs / 1_000).toFixed(1)} K`
  }
  return `${sign}₹${abs.toLocaleString('en-IN')}`
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function formatMonths(months: number): string {
  const years = Math.floor(months / 12)
  const rem = months % 12
  if (years === 0) return `${rem} mo`
  if (rem === 0) return `${years} yr`
  return `${years} yr ${rem} mo`
}
