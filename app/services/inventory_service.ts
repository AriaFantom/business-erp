import db from '@adonisjs/lucid/services/db'
import cache from '@adonisjs/cache/services/main'
import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Inventory from '#models/inventory'
import StockMovement from '#models/stock_movement'
import type User from '#models/user'
import { InsufficientStockError } from '#services/domain_errors'
import { audit } from '#services/audit'

export type ItemKind = 'material' | 'component' | 'product' | 'printer'

export type MovementReason =
  | 'purchase'
  | 'job_consume'
  | 'job_return'
  | 'job_produce'
  | 'sale'
  | 'sale_return'
  | 'adjustment_increase'
  | 'adjustment_decrease'

export type MovementInput = {
  itemKind: ItemKind
  itemId: number
  /** Signed: positive = inbound, negative = outbound. */
  qty: number
  unitCost: number
  reason: MovementReason
  referenceType?: string | null
  referenceId?: number | null
  note?: string | null
  actor: User
  trx: TransactionClientContract
}

const SNAPSHOT_KEY = 'inventory:snapshot:v1'

/**
 * Load (and lock) the current inventory row for an item, creating it at zero
 * if absent. Locks the row with FOR UPDATE so concurrent writers serialise.
 */
async function lockInventory(
  itemKind: ItemKind,
  itemId: number,
  trx: TransactionClientContract
): Promise<Inventory> {
  // Postgres: FOR UPDATE on the row — concurrent consumers wait here.
  const existing = await Inventory.query({ client: trx })
    .where('itemKind', itemKind)
    .where('itemId', itemId)
    .forUpdate()
    .first()

  if (existing) return existing

  // Need to insert + immediately lock. Insert under transaction; subsequent
  // writers in another transaction will hit the unique index and retry.
  const inv = new Inventory()
  inv.itemKind = itemKind
  inv.itemId = itemId
  inv.qty = '0'
  inv.avgUnitCost = '0'
  inv.useTransaction(trx)
  await inv.save()
  return inv
}

/**
 * Apply a single signed movement: inserts a `stock_movements` row and
 * adjusts the matching `inventory.qty` (+ weighted-average cost on inbound).
 *
 * Caller MUST be inside a transaction. Rejects negative-stock outcomes with
 * `InsufficientStockError`. Cache invalidation runs at the end so concurrent
 * snapshot readers always see fresh data after commit.
 */
export async function applyMovement(input: MovementInput): Promise<StockMovement | undefined> {
  if (input.itemKind === 'printer') {
    // Printers are not fungible stock; they exist as rows in `printers` instead.
    return
  }

  const { trx, actor } = input

  if (input.qty === 0) {
    throw new Error('applyMovement: qty must not be zero')
  }

  const inv = await lockInventory(input.itemKind, input.itemId, trx)
  const oldQty = Number(inv.qty)
  const oldAvg = Number(inv.avgUnitCost)
  const newQty = oldQty + input.qty

  if (newQty < 0) {
    throw new InsufficientStockError({
      itemKind: input.itemKind,
      itemId: input.itemId,
      available: oldQty,
      requested: -input.qty,
    })
  }

  // Weighted-average cost only updates on inbound movements with a real
  // unit cost. Outbound movements consume at the *current* avg without
  // changing it.
  let newAvg = oldAvg
  if (input.qty > 0 && input.unitCost > 0) {
    newAvg = (oldQty * oldAvg + input.qty * input.unitCost) / (oldQty + input.qty)
  } else if (newQty === 0) {
    // Once stock drains to zero, reset the avg so the next inbound batch
    // sets a fresh baseline rather than carrying historical drift.
    newAvg = 0
  }

  inv.qty = String(newQty)
  inv.avgUnitCost = newAvg.toFixed(4)
  await inv.save()

  const move = new StockMovement()
  move.itemKind = input.itemKind
  move.itemId = input.itemId
  move.qty = String(input.qty)
  move.unitCost = String(input.unitCost)
  move.reason = input.reason
  move.referenceType = input.referenceType ?? null
  move.referenceId = input.referenceId ?? null
  move.note = input.note ?? null
  move.createdByUserId = actor.id
  move.createdAt = DateTime.now()
  move.useTransaction(trx)
  await move.save()

  await audit({
    actor,
    action: `inventory.${input.reason}`,
    targetType: input.itemKind,
    targetId: input.itemId,
    payload: {
      qty: input.qty,
      unitCost: input.unitCost,
      reference: input.referenceType ? { type: input.referenceType, id: input.referenceId } : null,
    },
    trx,
  })

  return move
}

/**
 * Manual stock adjustment by a privileged user.
 * `qtyDelta` is signed; reason is derived from sign.
 */
export async function adjustStock(opts: {
  itemKind: ItemKind
  itemId: number
  qtyDelta: number
  unitCost?: number
  note: string
  actor: User
}): Promise<StockMovement> {
  if (opts.qtyDelta === 0) {
    throw new Error('adjustStock: qtyDelta must not be zero')
  }
  const reason: MovementReason = opts.qtyDelta > 0 ? 'adjustment_increase' : 'adjustment_decrease'

  return db
    .transaction(async (trx) => {
      const move = await applyMovement({
        itemKind: opts.itemKind,
        itemId: opts.itemId,
        qty: opts.qtyDelta,
        unitCost: opts.unitCost ?? 0,
        reason,
        note: opts.note,
        actor: opts.actor,
        trx,
      })
      if (!move) {
        throw new Error('adjustStock cannot target a printer')
      }
      return move
    })
    .finally(() => invalidateSnapshotCache())
}

// ── Snapshot cache ──────────────────────────────────────────────────────

export type SnapshotEntry = {
  itemKind: ItemKind
  itemId: number
  qty: number
  avgUnitCost: number
}

export async function getSnapshot(): Promise<SnapshotEntry[]> {
  const rows = await cache.getOrSet({
    key: SNAPSHOT_KEY,
    ttl: '5m',
    factory: async () => {
      const all = await Inventory.query()
      return all.map((i) => ({
        itemKind: i.itemKind as ItemKind,
        itemId: i.itemId,
        qty: Number(i.qty),
        avgUnitCost: Number(i.avgUnitCost),
      }))
    },
  })
  return rows
}

export async function invalidateSnapshotCache(): Promise<void> {
  await cache.delete({ key: SNAPSHOT_KEY })
}
