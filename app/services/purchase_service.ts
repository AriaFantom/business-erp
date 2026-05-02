import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Purchase from '#models/purchase'
import PurchaseItem from '#models/purchase_item'
import Material from '#models/material'
import Component from '#models/component'
import Supplier from '#models/supplier'
import type User from '#models/user'
import { applyMovement, invalidateSnapshotCache } from '#services/inventory_service'
import { audit } from '#services/audit'
import { nextDocNumber } from '#services/numbering'
import { InvalidStateError } from '#services/domain_errors'

export type PurchaseLineInput = {
  itemKind: 'material' | 'component'
  itemId: number
  qty: number
  unitCost: number
  taxRatePct: number
}

export type CreatePurchaseInput = {
  supplierId: number
  purchasedAt: DateTime
  note?: string | null
  attachmentKey?: string | null
  items: PurchaseLineInput[]
  actor: User
}

function recomputeLine(line: PurchaseLineInput) {
  const subtotal = round2(line.qty * line.unitCost)
  const tax = round2((subtotal * line.taxRatePct) / 100)
  const total = round2(subtotal + tax)
  return { lineSubtotal: subtotal, lineTax: tax, lineTotal: total }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

async function ensureItemExists(kind: 'material' | 'component', id: number) {
  if (kind === 'material') {
    await Material.findOrFail(id)
  } else {
    await Component.findOrFail(id)
  }
}

/**
 * Create a draft purchase with header + lines, computing totals atomically.
 * Confirming the purchase (separate call) is what actually moves stock.
 */
export async function createPurchase(input: CreatePurchaseInput): Promise<Purchase> {
  const supplier = await Supplier.findOrFail(input.supplierId)
  if (!supplier.isActive) {
    throw new InvalidStateError({
      entity: 'supplier',
      from: 'archived',
      to: 'used in purchase',
    })
  }
  for (const item of input.items) {
    await ensureItemExists(item.itemKind, item.itemId)
  }

  return db.transaction(async (trx) => {
    const number = await nextDocNumber('PO', trx, input.purchasedAt)

    let subtotal = 0
    let taxTotal = 0
    let total = 0
    const lines = input.items.map((l) => {
      const t = recomputeLine(l)
      subtotal += t.lineSubtotal
      taxTotal += t.lineTax
      total += t.lineTotal
      return { ...l, ...t }
    })

    const purchase = new Purchase()
    purchase.number = number
    purchase.supplierId = input.supplierId
    purchase.status = 'draft'
    purchase.purchasedAt = input.purchasedAt
    purchase.subtotal = String(round2(subtotal))
    purchase.taxTotal = String(round2(taxTotal))
    purchase.total = String(round2(total))
    purchase.note = input.note ?? null
    purchase.attachmentKey = input.attachmentKey ?? null
    purchase.createdByUserId = input.actor.id
    purchase.useTransaction(trx)
    await purchase.save()

    for (const l of lines) {
      const item = new PurchaseItem()
      item.purchaseId = purchase.id
      item.itemKind = l.itemKind
      item.itemId = l.itemId
      item.qty = String(l.qty)
      item.unitCost = String(l.unitCost)
      item.taxRatePct = String(l.taxRatePct)
      item.lineSubtotal = String(l.lineSubtotal)
      item.lineTax = String(l.lineTax)
      item.lineTotal = String(l.lineTotal)
      item.useTransaction(trx)
      await item.save()
    }

    await audit({
      actor: input.actor,
      action: 'purchase.create',
      targetType: 'purchase',
      targetId: purchase.id,
      payload: { number, supplierId: input.supplierId, lineCount: input.items.length },
      trx,
    })

    return purchase
  })
}

/**
 * Confirm a draft purchase. Writes inbound stock movements for every line
 * (driving inventory + weighted-average cost) and flips the header status.
 * All-or-nothing inside one transaction.
 */
export async function confirmPurchase(purchaseId: number, actor: User): Promise<Purchase> {
  const result = await db.transaction(async (trx) => {
    const purchase = await Purchase.query({ client: trx })
      .where('id', purchaseId)
      .forUpdate()
      .firstOrFail()
    if (purchase.status !== 'draft') {
      throw new InvalidStateError({
        entity: 'purchase',
        from: purchase.status,
        to: 'confirmed',
      })
    }

    const lines = await PurchaseItem.query({ client: trx }).where('purchase_id', purchaseId)

    for (const l of lines) {
      await applyMovement({
        itemKind: l.itemKind as 'material' | 'component',
        itemId: l.itemId,
        qty: Number(l.qty),
        unitCost: Number(l.unitCost),
        reason: 'purchase',
        referenceType: 'purchase',
        referenceId: purchase.id,
        note: null,
        actor,
        trx,
      })
    }

    purchase.status = 'confirmed'
    purchase.confirmedAt = DateTime.now()
    purchase.confirmedByUserId = actor.id
    await purchase.save()

    await audit({
      actor,
      action: 'purchase.confirm',
      targetType: 'purchase',
      targetId: purchase.id,
      payload: { number: purchase.number, total: purchase.total },
      trx,
    })

    return purchase
  })

  await invalidateSnapshotCache()
  return result
}

/** Cancel a draft purchase. Confirmed purchases cannot be cancelled. */
export async function cancelPurchase(purchaseId: number, actor: User): Promise<Purchase> {
  return db.transaction(async (trx) => {
    const purchase = await Purchase.query({ client: trx })
      .where('id', purchaseId)
      .forUpdate()
      .firstOrFail()
    if (purchase.status !== 'draft') {
      throw new InvalidStateError({
        entity: 'purchase',
        from: purchase.status,
        to: 'cancelled',
      })
    }

    purchase.status = 'cancelled'
    purchase.cancelledAt = DateTime.now()
    purchase.cancelledByUserId = actor.id
    await purchase.save()

    await audit({
      actor,
      action: 'purchase.cancel',
      targetType: 'purchase',
      targetId: purchase.id,
      trx,
    })
    return purchase
  })
}
