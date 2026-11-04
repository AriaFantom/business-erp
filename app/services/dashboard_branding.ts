import { randomUUID } from 'node:crypto'
import drive from '@adonisjs/drive/services/main'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import AppSetting from '#models/app_setting'
import type User from '#models/user'
import { audit } from '#services/audit'
import { token } from '#services/file_streaming'
import { APP_CURRENCY_KEY, DEFAULT_CURRENCY, isSupportedCurrency } from '#services/currency'

const KEY = 'dashboard_branding'
const DEFAULT_NAME = 'LayerDreams'

export type DashboardBranding = { name: string; iconKey: string | null; iconUrl: string | null }

function parseBranding(value: unknown): Pick<DashboardBranding, 'name' | 'iconKey'> {
  const stored = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return {
    name: typeof stored.name === 'string' && stored.name.trim() ? stored.name : DEFAULT_NAME,
    iconKey: typeof stored.iconKey === 'string' ? stored.iconKey : null,
  }
}

export async function getDashboardBranding(): Promise<DashboardBranding> {
  const row = await AppSetting.findBy('key', KEY)
  const branding = parseBranding(row?.value)
  return {
    ...branding,
    iconUrl: branding.iconKey ? `/branding/icon?v=${token(branding.iconKey)}` : null,
  }
}

async function updateBranding(
  actor: User,
  change: (
    current: Pick<DashboardBranding, 'name' | 'iconKey'>
  ) => Pick<DashboardBranding, 'name' | 'iconKey'>,
  action: string
): Promise<string | null> {
  return db.transaction(async (trx) => {
    await trx.rawQuery('SELECT pg_advisory_xact_lock(179000, 2)')
    let row = await AppSetting.query({ client: trx }).where('key', KEY).forUpdate().first()
    const before = parseBranding(row?.value)
    const after = change(before)
    if (!row) row = new AppSetting()
    row.key = KEY
    row.value = after
    row.updatedBy = actor.id
    row.useTransaction(trx)
    await row.save()
    await audit({
      actor,
      action,
      targetType: 'app_setting',
      targetId: row.id,
      payload: { before: { name: before.name }, after: { name: after.name } },
      trx,
    })
    return before.iconKey
  })
}

async function deleteOldIcon(key: string | null): Promise<void> {
  if (!key) return
  try {
    await drive.use().delete(key)
  } catch (error) {
    logger.warn({ error, key }, 'dashboard_branding: failed to delete icon')
  }
}

export async function renameDashboard(actor: User, name: string): Promise<void> {
  await updateBranding(actor, (current) => ({ ...current, name }), 'settings.branding.rename')
}

export async function replaceDashboardIcon(actor: User, file: MultipartFile): Promise<void> {
  const key = `branding/${randomUUID()}.${file.extname}`
  await file.moveToDisk(key)
  let previousKey: string | null
  try {
    previousKey = await updateBranding(
      actor,
      (current) => ({ ...current, iconKey: key }),
      'settings.branding.icon.update'
    )
  } catch (error) {
    await deleteOldIcon(key)
    throw error
  }
  await deleteOldIcon(previousKey)
}

export async function removeDashboardIcon(actor: User): Promise<void> {
  const previousKey = await updateBranding(
    actor,
    (current) => ({ ...current, iconKey: null }),
    'settings.branding.icon.remove'
  )
  await deleteOldIcon(previousKey)
}

export async function saveApplicationSettings(
  actor: User,
  input: {
    name: string
    currency: string
    icon?: MultipartFile
    removeIcon?: boolean
  }
): Promise<void> {
  const currency = input.currency.toUpperCase()
  if (!isSupportedCurrency(currency)) throw new Error('Unsupported currency code.')

  const newIconKey = input.icon ? `branding/${randomUUID()}.${input.icon.extname}` : null
  if (newIconKey && input.icon) await input.icon.moveToDisk(newIconKey)

  let previousIconKey: string | null = null
  const stalePdfKeys: string[] = []
  try {
    await db.transaction(async (trx) => {
      await trx.rawQuery('SELECT pg_advisory_xact_lock(179000, 3)')
      let brandingRow = await AppSetting.query({ client: trx })
        .where('key', KEY)
        .forUpdate()
        .first()
      let currencyRow = await AppSetting.query({ client: trx })
        .where('key', APP_CURRENCY_KEY)
        .forUpdate()
        .first()
      const beforeBranding = parseBranding(brandingRow?.value)
      const beforeCurrency =
        typeof currencyRow?.value === 'string' ? currencyRow.value : DEFAULT_CURRENCY
      previousIconKey = beforeBranding.iconKey
      const iconKey = newIconKey ?? (input.removeIcon ? null : beforeBranding.iconKey)

      if (!brandingRow) brandingRow = new AppSetting()
      brandingRow.key = KEY
      brandingRow.value = { name: input.name, iconKey }
      brandingRow.updatedBy = actor.id
      brandingRow.useTransaction(trx)
      await brandingRow.save()

      if (!currencyRow) currencyRow = new AppSetting()
      currencyRow.key = APP_CURRENCY_KEY
      currencyRow.value = currency
      currencyRow.updatedBy = actor.id
      currencyRow.useTransaction(trx)
      await currencyRow.save()

      await audit({
        actor,
        action: 'settings.application.update',
        targetType: 'app_setting',
        targetId: brandingRow.id,
        payload: {
          before: { name: beforeBranding.name, currency: beforeCurrency },
          after: { name: input.name, currency },
          iconChanged: Boolean(newIconKey || input.removeIcon),
        },
        trx,
      })

      if (beforeCurrency !== currency) {
        const invoicePdfs = await trx.from('invoices').whereNotNull('pdf_key').select('pdf_key')
        const quotationPdfs = await trx.from('quotations').whereNotNull('pdf_key').select('pdf_key')
        stalePdfKeys.push(
          ...invoicePdfs.map((row) => String(row.pdf_key)),
          ...quotationPdfs.map((row) => String(row.pdf_key))
        )
        await trx.from('invoices').whereNotNull('pdf_key').update({ pdf_key: null })
        await trx.from('quotations').whereNotNull('pdf_key').update({ pdf_key: null })
      }
    })
  } catch (error) {
    if (newIconKey) await deleteOldIcon(newIconKey)
    throw error
  }

  if ((newIconKey || input.removeIcon) && previousIconKey && previousIconKey !== newIconKey) {
    await deleteOldIcon(previousIconKey)
  }
  for (const key of stalePdfKeys) await deleteOldIcon(key)
}
