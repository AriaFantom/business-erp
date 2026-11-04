import { usePage } from '@inertiajs/react'

export function useCurrency(): string {
  const { currency } = usePage().props as { currency?: string }
  return currency ?? 'INR'
}

export function formatMoney(
  value: string | number | null | undefined,
  currency: string,
  options: Intl.NumberFormatOptions = {}
): string {
  if (value === null || value === undefined) return '—'
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '—'
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(amount)
}

export function currencyLabel(currency: string): string {
  return currency.toUpperCase()
}
