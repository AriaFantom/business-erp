import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import StockTake from '#models/stock_take'
import StockTakeItem from '#models/stock_take_item'
import Inventory from '#models/inventory'
import type User from '#models/user'
import { nextDocNumber } from '#services/numbering'
import {
  applyMovement,
  invalidateSnapshotCache,
  type ItemKind,
  type MovementReason,
} from '#services/inventory_service'
import { InvalidStateError } from '#services/domain_errors'
import { audit } from '#services/audit'

/** Item kinds a stock take is allowed to hold lines for (machines are excluded). */
type StockTakeItemKind = 'material' | 'component' | 'product'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Start a new stock take: snapshots every current inventory row (material,
 * component, product) as a draft line to be counted.
 */
export async function createStockTake(opts: {
  note?: string | null
  actor: User
}): Promise<StockTake> {
  return db.transaction(async (trx) => {
    const number = await nextDocNumber('ST', trx)

    const st = new StockTake()
    st.number = number
    st.status = 'draft'
    st.note = opts.note ?? null
    st.createdByUserId = opts.actor.id
    st.useTransaction(trx)
    await st.save()

    const inventoryRows = await Inventory.query({ client: trx }).whereIn('itemKind', [
      'material',
      'component',
      'product',
    ])

    for (const inv of inventoryRows) {
      const item = new StockTakeItem()
      item.stockTakeId = st.id
      item.itemKind = inv.itemKind
      item.itemId = inv.itemId
      item.expectedQty = inv.qty
      item.unitCost = inv.avgUnitCost
      item.countedQty = null
      item.useTransaction(trx)
      await item.save()
    }

    await audit({
      actor: opts.actor,
      action: 'stocktake.create',
      targetType: 'stock_take',
      targetId: st.id,
      payload: { number: st.number, lineCount: inventoryRows.length },
      trx,
    })

    return st
  })
}

export type CountLine = {
  itemKind: StockTakeItemKind
  itemId: number
  countedQty: number | null
}

/**
 * Record counted quantities against a draft stock take's lines. Purely a
 * bookkeeping write — no inventory mutation happens until completion.
 * Unknown (itemKind, itemId) pairs are silently ignored.
 */
export async function saveCounts(opts: {
  stockTakeId: number
  counts: CountLine[]
  actor: User
}): Promise<StockTake> {
  return db.transaction(async (trx) => {
    const st = await StockTake.query({ client: trx })
      .where('id', opts.stockTakeId)
      .forUpdate()
      .firstOrFail()

    if (st.status !== 'draft') {
      throw new InvalidStateError({ entity: 'stock take', from: st.status, to: 'draft' })
    }

    const items = await StockTakeItem.query({ client: trx }).where('stockTakeId', st.id)
    const byKey = new Map(items.map((i) => [`${i.itemKind}:${i.itemId}`, i]))

    for (const c of opts.counts) {
      const item = byKey.get(`${c.itemKind}:${c.itemId}`)
      if (!item) continue
      item.countedQty = c.countedQty === null ? null : c.countedQty.toFixed(3)
      item.useTransaction(trx)
      await item.save()
    }

    return st
  })
}

/**
 * Re-snapshot expected_qty + unit_cost from current inventory for every line
 * on a draft stock take (e.g. after other movements happened mid-count).
 */
export async function refreshExpected(opts: {
  stockTakeId: number
  actor: User
}): Promise<StockTake> {
  return db.transaction(async (trx) => {
    const st = await StockTake.query({ client: trx })
      .where('id', opts.stockTakeId)
      .forUpdate()
      .firstOrFail()

    if (st.status !== 'draft') {
      throw new InvalidStateError({ entity: 'stock take', from: st.status, to: 'draft' })
    }

    const items = await StockTakeItem.query({ client: trx }).where('stockTakeId', st.id)

    for (const item of items) {
      const inv = await Inventory.query({ client: trx })
        .where('itemKind', item.itemKind)
        .where('itemId', item.itemId)
        .first()
      item.expectedQty = inv ? inv.qty : '0'
      item.unitCost = inv ? inv.avgUnitCost : '0'
      item.useTransaction(trx)
      await item.save()
    }

    return st
  })
}

/**
 * Complete a draft stock take: for every counted line, push inventory to
 * exactly match the counted qty via a signed adjustment movement (mirrors
 * `adjustStock`'s reason derivation, but runs inside our own transaction so
 * it commits/rolls back atomically with the stock take itself).
 *
 * The delta is computed against the *current* inventory qty read fresh
 * inside this transaction — `expected_qty` is only a display baseline and
 * may be stale by the time the count is completed.
 */
export async function completeStockTake(opts: {
  stockTakeId: number
  actor: User
}): Promise<StockTake> {
  const st = await db.transaction(async (trx) => {
    const stockTake = await StockTake.query({ client: trx })
      .where('id', opts.stockTakeId)
      .forUpdate()
      .firstOrFail()

    if (stockTake.status !== 'draft') {
      throw new InvalidStateError({ entity: 'stock take', from: stockTake.status, to: 'completed' })
    }

    const items = await StockTakeItem.query({ client: trx }).where('stockTakeId', stockTake.id)

    let adjustedLines = 0
    let totalVarianceValue = 0

    for (const item of items) {
      if (item.countedQty === null) continue

      // Lock (and read fresh) the live inventory row inside this trx.
      const currentInv = await Inventory.query({ client: trx })
        .where('itemKind', item.itemKind)
        .where('itemId', item.itemId)
        .forUpdate()
        .first()
      const currentQty = currentInv ? Number(currentInv.qty) : 0
      const countedQty = Number(item.countedQty)
      const delta = countedQty - currentQty

      // Ignore no-op counts (matches applyMovement's own zero-delta guard).
      if (Math.abs(delta) < 0.0005) continue

      const unitCost = currentInv ? Number(currentInv.avgUnitCost) : Number(item.unitCost)
      const reason: MovementReason = delta > 0 ? 'adjustment_increase' : 'adjustment_decrease'

      await applyMovement({
        itemKind: item.itemKind as ItemKind,
        itemId: item.itemId,
        qty: delta,
        unitCost,
        reason,
        referenceType: 'stock_take',
        referenceId: stockTake.id,
        note: `Stock take ${stockTake.number}`,
        actor: opts.actor,
        trx,
      })

      adjustedLines++
      totalVarianceValue += delta * unitCost
    }

    stockTake.status = 'completed'
    stockTake.completedByUserId = opts.actor.id
    stockTake.completedAt = DateTime.now()
    stockTake.useTransaction(trx)
    await stockTake.save()

    await audit({
      actor: opts.actor,
      action: 'stocktake.complete',
      targetType: 'stock_take',
      targetId: stockTake.id,
      payload: { adjustedLines, totalVarianceValue: round2(totalVarianceValue) },
      trx,
    })

    return stockTake
  })

  await invalidateSnapshotCache()
  return st
}

/** Cancel a draft stock take without touching inventory. */
export async function cancelStockTake(opts: {
  stockTakeId: number
  actor: User
}): Promise<StockTake> {
  return db.transaction(async (trx) => {
    const st = await StockTake.query({ client: trx })
      .where('id', opts.stockTakeId)
      .forUpdate()
      .firstOrFail()

    if (st.status !== 'draft') {
      throw new InvalidStateError({ entity: 'stock take', from: st.status, to: 'cancelled' })
    }

    st.status = 'cancelled'
    st.useTransaction(trx)
    await st.save()

    await audit({
      actor: opts.actor,
      action: 'stocktake.cancel',
      targetType: 'stock_take',
      targetId: st.id,
      payload: null,
      trx,
    })

    return st
  })
}
