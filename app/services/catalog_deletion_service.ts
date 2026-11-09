import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import logger from '@adonisjs/core/services/logger'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Material from '#models/material'
import Component from '#models/component'
import Product from '#models/product'
import Machine from '#models/machine'
import type User from '#models/user'
import { audit } from '#services/audit'
import { DomainError } from '#services/domain_errors'

export type DeletableKind = 'material' | 'component' | 'product' | 'machine'

const typedColumn = (kind: 'material' | 'component' | 'product') =>
  kind === 'product' ? 'catalog_product_id' : `${kind}_id`

async function markReferenced(
  blockers: Map<number, string>,
  ids: number[],
  table: string,
  column: string,
  message: string
) {
  if (ids.length === 0) return
  const rows = await db.from(table).whereIn(column, ids).whereNotNull(column).distinct(column)
  for (const row of rows) {
    const id = Number(row[column])
    if (!blockers.has(id)) blockers.set(id, message)
  }
}

export async function getDeletionBlockers(
  kind: DeletableKind,
  ids: number[]
): Promise<Map<number, string>> {
  const blockers = new Map<number, string>()
  if (ids.length === 0) return blockers

  if (kind === 'machine') {
    const purchased = await db
      .from('machines')
      .whereIn('id', ids)
      .whereNotNull('purchase_item_id')
      .select('id')
    for (const row of purchased) blockers.set(Number(row.id), 'Purchase history exists.')
    await markReferenced(blockers, ids, 'production_jobs', 'machine_id', 'Production jobs exist.')
    await markReferenced(blockers, ids, 'expenses', 'machine_id', 'Machine expenses exist.')
    await markReferenced(
      blockers,
      ids,
      'production_outputs',
      'machine_id',
      'Production and sales tracking exists.'
    )
    return blockers
  }

  const column = typedColumn(kind)
  const common: Array<[string, string]> = [
    ['stock_movements', 'Stock movement history exists.'],
    ['stock_take_items', 'Stock-take history exists.'],
  ]
  for (const [table, message] of common) {
    await markReferenced(blockers, ids, table, column, message)
  }

  const stocked = await db
    .from('inventory')
    .whereIn(column, ids)
    .whereNot('qty', '0')
    .select(column)
  for (const row of stocked) {
    const id = Number(row[column])
    if (!blockers.has(id)) blockers.set(id, 'Stock remains on hand.')
  }

  if (kind === 'material' || kind === 'component') {
    const history: Array<[string, string]> = [
      ['product_recipes', 'Used by a product recipe.'],
      ['quotation_item_boms', 'Used by a quotation.'],
      ['purchase_items', 'Purchase history exists.'],
      ['purchase_return_items', 'Supplier return history exists.'],
      ['job_material_consumptions', 'Production consumption history exists.'],
    ]
    for (const [table, message] of history) {
      await markReferenced(blockers, ids, table, column, message)
    }
    return blockers
  }

  const productHistory: Array<[string, string]> = [
    ['quotation_items', 'Quotation history exists.'],
    ['order_items', 'Sales history exists.'],
    ['invoice_items', 'Invoice history exists.'],
    ['order_return_items', 'Sales return history exists.'],
    ['production_jobs', 'Production jobs exist.'],
    ['production_outputs', 'Production and sales tracking exists.'],
  ]
  for (const [table, message] of productHistory) {
    await markReferenced(blockers, ids, table, 'product_id', message)
  }
  return blockers
}

async function blockerInTransaction(
  trx: TransactionClientContract,
  kind: DeletableKind,
  id: number
): Promise<string | null> {
  const exists = async (table: string, column: string, extra?: (query: any) => void) => {
    const query = trx.from(table).where(column, id)
    extra?.(query)
    return Boolean(await query.first())
  }

  if (kind === 'machine') {
    const machine = await trx.from('machines').where('id', id).first()
    if (machine?.purchase_item_id) return 'Purchase history exists.'
    if (await exists('production_jobs', 'machine_id')) return 'Production jobs exist.'
    if (await exists('expenses', 'machine_id')) return 'Machine expenses exist.'
    if (await exists('production_outputs', 'machine_id'))
      return 'Production and sales tracking exists.'
    return null
  }

  const column = typedColumn(kind)
  if (await exists('inventory', column, (query) => query.whereNot('qty', '0'))) {
    return 'Stock remains on hand.'
  }
  if (await exists('stock_movements', column)) return 'Stock movement history exists.'
  if (await exists('stock_take_items', column)) return 'Stock-take history exists.'

  if (kind === 'material' || kind === 'component') {
    if (await exists('product_recipes', column)) return 'Used by a product recipe.'
    if (await exists('quotation_item_boms', column)) return 'Used by a quotation.'
    if (await exists('purchase_items', column)) return 'Purchase history exists.'
    if (await exists('purchase_return_items', column)) return 'Supplier return history exists.'
    if (await exists('job_material_consumptions', column)) {
      return 'Production consumption history exists.'
    }
    return null
  }

  if (await exists('quotation_items', 'product_id')) return 'Quotation history exists.'
  if (await exists('order_items', 'product_id')) return 'Sales history exists.'
  if (await exists('invoice_items', 'product_id')) return 'Invoice history exists.'
  if (await exists('order_return_items', 'product_id')) return 'Sales return history exists.'
  if (await exists('production_jobs', 'product_id')) return 'Production jobs exist.'
  if (await exists('production_outputs', 'product_id')) {
    return 'Production and sales tracking exists.'
  }
  return null
}

async function deleteObjects(keys: string[]) {
  for (const key of keys) {
    try {
      await drive.use().delete(key)
    } catch (error) {
      logger.warn({ error, key }, 'catalog_delete: failed to clean stored object')
    }
  }
}

export async function deleteUnusedCatalogItem(kind: DeletableKind, id: number, actor: User) {
  const storedKeys: string[] = []
  try {
    await db.transaction(async (trx) => {
      const model =
        kind === 'material'
          ? await Material.query({ client: trx }).where('id', id).forUpdate().firstOrFail()
          : kind === 'component'
            ? await Component.query({ client: trx }).where('id', id).forUpdate().firstOrFail()
            : kind === 'product'
              ? await Product.query({ client: trx }).where('id', id).forUpdate().firstOrFail()
              : await Machine.query({ client: trx }).where('id', id).forUpdate().firstOrFail()

      const blocker = await blockerInTransaction(trx, kind, id)
      if (blocker) {
        throw new DomainError({
          code: 'CATALOG_DELETE_BLOCKED',
          message: `${blocker} Archive or retire this record instead.`,
        })
      }

      if (kind !== 'machine') {
        await trx.from('inventory').where(typedColumn(kind), id).where('qty', '0').delete()
      }
      if ('imageKey' in model && model.imageKey) storedKeys.push(model.imageKey)
      if (kind === 'product') {
        const attachments = await trx
          .from('product_attachments')
          .where('product_id', id)
          .select('file_key')
        storedKeys.push(...attachments.map((row) => String(row.file_key)))
      }

      const name = 'name' in model ? model.name : `${kind} #${id}`
      await model.delete()
      await audit({
        actor,
        action: `${kind}.delete`,
        targetType: kind,
        targetId: id,
        payload: { name },
        trx,
      })
    })
  } catch (error) {
    if ((error as { code?: string }).code === '23503') {
      throw new DomainError({
        code: 'CATALOG_DELETE_BLOCKED',
        message: 'This record became linked to business history and cannot be deleted.',
      })
    }
    throw error
  }
  await deleteObjects(storedKeys)
}
