import db from '@adonisjs/lucid/services/db'
import AppSetting from '#models/app_setting'
import type User from '#models/user'
import { audit } from '#services/audit'

export const APP_CURRENCY_KEY = 'app_currency'
export const DEFAULT_CURRENCY = 'INR'

export function supportedCurrencyCodes(): string[] {
  const supportedValuesOf = (
    Intl as typeof Intl & {
      supportedValuesOf?: (key: 'currency') => string[]
    }
  ).supportedValuesOf
  return supportedValuesOf ? supportedValuesOf('currency') : [DEFAULT_CURRENCY, 'USD', 'EUR', 'GBP']
}

export function isSupportedCurrency(value: string): boolean {
  return supportedCurrencyCodes().includes(value.toUpperCase())
}

export async function getAppCurrency(): Promise<string> {
  const row = await AppSetting.findBy('key', APP_CURRENCY_KEY)
  const value = typeof row?.value === 'string' ? row.value.toUpperCase() : DEFAULT_CURRENCY
  return isSupportedCurrency(value) ? value : DEFAULT_CURRENCY
}

export async function setAppCurrency(actor: User, currency: string): Promise<void> {
  const normalized = currency.toUpperCase()
  if (!isSupportedCurrency(normalized)) throw new Error('Unsupported currency code.')

  await db.transaction(async (trx) => {
    await trx.rawQuery('SELECT pg_advisory_xact_lock(179000, 3)')
    let row = await AppSetting.query({ client: trx })
      .where('key', APP_CURRENCY_KEY)
      .forUpdate()
      .first()
    const before = typeof row?.value === 'string' ? row.value : DEFAULT_CURRENCY
    if (!row) row = new AppSetting()
    row.key = APP_CURRENCY_KEY
    row.value = normalized
    row.updatedBy = actor.id
    row.useTransaction(trx)
    await row.save()
    await audit({
      actor,
      action: 'settings.currency.update',
      targetType: 'app_setting',
      targetId: row.id,
      payload: { before, after: normalized },
      trx,
    })
  })
}

export function formatCurrency(
  value: string | number,
  currency: string,
  options: Intl.NumberFormatOptions = {}
): string {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return String(value)
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(amount)
}
