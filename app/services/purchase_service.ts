import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Purchase from '#models/purchase'
import PurchaseItem from '#models/purchase_item'
import PurchaseReturn from '#models/purchase_return'
import PurchaseReturnItem from '#models/purchase_return_item'
import PurchasePayment from '#models/purchase_payment'
import Material from '#models/material'
import Component from '#models/component'
import Machine from '#models/machine'
import Supplier from '#models/supplier'
import type User from '#models/user'
import { applyMovement, invalidateSnapshotCache } from '#services/inventory_service'
import { audit } from '#services/audit'
import { nextDocNumber } from '#services/numbering'
import { DomainError, InvalidStateError } from '#services/domain_errors'

export type PurchaseLineInput = {
  itemKind: 'material' | 'component'
  itemId: number
  qty: number
  unitCost: number
  taxRatePct?: number
}

export type CreatePurchaseInput = {
  supplierId: number
  purchasedAt: DateTime
  note?: string | null
  attachmentKey?: string | null
  shippingCharge?: number
  taxAmount?: number
  items: PurchaseLineInput[]
  actor: User
}

function recomputeLine(line: PurchaseLineInput) {
  const subtotal = round2(line.qty * line.unitCost)
  const tax = round2((subtotal * (line.taxRatePct ?? 0)) / 100)
  const total = round2(subtotal + tax)
  return { lineSubtotal: subtotal, lineTax: tax, lineTotal: total }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 10_000) / 10_000
}

const MAX_DATABASE_MONEY = 999_999_999_999.99
const MAX_DATABASE_UNIT_COST = 9_999_999_999.9999

function normalizeCharge(value: number | undefined, label: string): number {
  if (value === undefined) return 0
  const scaled = value * 100
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > 99_999_999_999 ||
    Math.abs(scaled - Math.round(scaled)) > 1e-7
  ) {
    throw new DomainError({
      code: 'INVALID_PURCHASE_CHARGE',
      message: `${label} must be a non-negative amount with no more than two decimal places.`,
    })
  }
  return round2(value)
}

function assertDatabaseMoney(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0 || value > MAX_DATABASE_MONEY) {
    throw new DomainError({
      code: 'PURCHASE_TOTAL_TOO_LARGE',
      message: `${label} is too large to save safely. Reduce the quantities or amounts.`,
    })
  }
}

function assertPurchaseLine(line: PurchaseLineInput) {
  if (!Number.isFinite(line.qty) || line.qty <= 0 || line.qty > 999_999_999) {
    throw new DomainError({
      code: 'INVALID_PURCHASE_LINE',
      message: 'Purchase quantities must be positive, finite numbers.',
    })
  }
  if (
    !Number.isFinite(line.unitCost) ||
    line.unitCost < 0 ||
    line.unitCost > MAX_DATABASE_UNIT_COST
  ) {
    throw new DomainError({
      code: 'INVALID_PURCHASE_LINE',
      message: 'A purchase unit cost is outside the supported database range.',
    })
  }
  const taxRatePct = line.taxRatePct ?? 0
  if (!Number.isFinite(taxRatePct) || taxRatePct < 0 || taxRatePct > 100) {
    throw new DomainError({
      code: 'INVALID_PURCHASE_LINE',
      message: 'A purchase line tax percentage must be between 0 and 100.',
    })
  }
}

function assertDatabaseUnitCost(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > MAX_DATABASE_UNIT_COST) {
    throw new DomainError({
      code: 'PURCHASE_TOTAL_TOO_LARGE',
      message: 'A landed unit cost is too large to save safely.',
    })
  }
}

/**
 * Allocate a fixed charge by goods value while keeping the result cent-exact.
 * Largest fractional remainders receive the spare cents; line order breaks ties.
 */
export function allocatePurchaseCharge(amount: number, goodsValues: number[]): number[] {
  const amountCents = Math.round(round2(amount) * 100)
  if (amountCents === 0) return goodsValues.map(() => 0)

  const weights = goodsValues.map((value) => BigInt(Math.round(round2(value) * 100)))
  const totalWeight = weights.reduce((sum, value) => sum + value, 0n)
  if (totalWeight <= 0n) {
    throw new DomainError({
      code: 'PURCHASE_CHARGES_REQUIRE_SUBTOTAL',
      message: 'Shipping and invoice tax cannot be allocated without a positive goods subtotal.',
    })
  }

  const amountCentsBigInt = BigInt(amountCents)
  const shares = weights.map((weight, index) => {
    const numerator = amountCentsBigInt * weight
    return {
      index,
      cents: numerator / totalWeight,
      remainder: numerator % totalWeight,
    }
  })
  const allocated = shares.map((share) => share.cents)
  const remaining = Number(amountCentsBigInt - allocated.reduce((sum, value) => sum + value, 0n))
  const priority = [...shares].sort((a, b) => {
    if (a.remainder === b.remainder) return a.index - b.index
    return a.remainder > b.remainder ? -1 : 1
  })

  for (let i = 0; i < remaining; i++) {
    allocated[priority[i % priority.length].index] += 1n
  }

  return allocated.map((cents) => Number(cents) / 100)
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
    assertPurchaseLine(item)
    await ensureItemExists(item.itemKind, item.itemId)
  }

  const shippingCharge = normalizeCharge(input.shippingCharge, 'Shipping charge')
  const usesInvoiceTax = input.taxAmount !== undefined
  const invoiceTax = normalizeCharge(input.taxAmount, 'Invoice tax')
  if (usesInvoiceTax && input.items.some((item) => (item.taxRatePct ?? 0) !== 0)) {
    throw new DomainError({
      code: 'PURCHASE_TAX_MODE_CONFLICT',
      message: 'Invoice tax cannot be combined with per-line tax percentages.',
    })
  }

  return db.transaction(async (trx) => {
    const number = await nextDocNumber('PO', trx, input.purchasedAt)

    let subtotal = 0
    let legacyTaxTotal = 0
    const baseLines = input.items.map((l) => {
      const t = recomputeLine(l)
      assertDatabaseMoney(t.lineSubtotal, 'A purchase line subtotal')
      assertDatabaseMoney(t.lineTotal, 'A purchase line total')
      subtotal += t.lineSubtotal
      legacyTaxTotal += t.lineTax
      return { ...l, taxRatePct: l.taxRatePct ?? 0, ...t }
    })
    subtotal = round2(subtotal)
    legacyTaxTotal = round2(legacyTaxTotal)
    assertDatabaseMoney(subtotal, 'The goods subtotal')

    if (subtotal <= 0 && (shippingCharge > 0 || invoiceTax > 0)) {
      throw new DomainError({
        code: 'PURCHASE_CHARGES_REQUIRE_SUBTOTAL',
        message: 'Shipping and invoice tax cannot be added when the goods subtotal is zero.',
      })
    }

    const shippingAllocations = allocatePurchaseCharge(
      shippingCharge,
      baseLines.map((line) => line.lineSubtotal)
    )
    const taxAllocations = allocatePurchaseCharge(
      usesInvoiceTax ? invoiceTax : 0,
      baseLines.map((line) => line.lineSubtotal)
    )
    const lines = baseLines.map((line, index) => {
      const landedUnitCost = round4(
        (line.lineSubtotal + shippingAllocations[index] + taxAllocations[index]) / line.qty
      )
      assertDatabaseUnitCost(landedUnitCost)
      return {
        ...line,
        allocatedShipping: shippingAllocations[index],
        allocatedTax: taxAllocations[index],
        landedUnitCost,
        lineTax: usesInvoiceTax ? 0 : line.lineTax,
        lineTotal: usesInvoiceTax ? line.lineSubtotal : line.lineTotal,
      }
    })
    const taxTotal = usesInvoiceTax ? invoiceTax : legacyTaxTotal
    const total = round2(subtotal + shippingCharge + taxTotal)
    assertDatabaseMoney(total, 'The purchase total')

    const purchase = new Purchase()
    purchase.number = number
    purchase.supplierId = input.supplierId
    purchase.status = 'draft'
    purchase.purchasedAt = input.purchasedAt
    purchase.subtotal = String(round2(subtotal))
    purchase.taxTotal = String(round2(taxTotal))
    purchase.shippingCharge = String(shippingCharge)
    purchase.taxEntryMode = usesInvoiceTax ? 'invoice_amount' : 'legacy_line'
    purchase.total = String(total)
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
      item.allocatedShipping = String(l.allocatedShipping)
      item.allocatedTax = String(l.allocatedTax)
      item.landedUnitCost = String(l.landedUnitCost)
      item.useTransaction(trx)
      await item.save()
    }

    await audit({
      actor: input.actor,
      action: 'purchase.create',
      targetType: 'purchase',
      targetId: purchase.id,
      payload: {
        number,
        supplierId: input.supplierId,
        lineCount: input.items.length,
        subtotal,
        shippingCharge,
        taxTotal,
        taxEntryMode: purchase.taxEntryMode,
        total,
      },
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
      if (l.itemKind === 'machine') {
        const qty = Math.floor(Number(l.qty))
        for (let i = 0; i < qty; i++) {
          const machine = new Machine()
          machine.name = `${purchase.supplierId ? `Supplier-${purchase.supplierId}` : 'Machine'} #${purchase.id}-${l.id}-${i + 1}`
          machine.purchaseItemId = l.id
          machine.acquiredAt = DateTime.now()
          machine.status = 'idle'
          machine.useTransaction(trx)
          await machine.save()
        }
        continue
      }
      await applyMovement({
        itemKind: l.itemKind as 'material' | 'component',
        itemId: l.itemId,
        qty: Number(l.qty),
        unitCost: l.landedUnitCost === null ? Number(l.unitCost) : Number(l.landedUnitCost),
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

export type ReturnPurchaseInput = {
  purchaseId: number
  items: { purchaseItemId: number; qty: number }[]
  note?: string | null
  actor: User
}

/**
 * Return items from a confirmed purchase back to the supplier (debit note).
 *
 * Supplier credit is valued at the original purchase unit cost; the outbound
 * stock movement itself is valued by `applyMovement` at the current
 * weighted-average cost. Throws `InsufficientStockError` if the stock has
 * already been consumed, and `RETURN_EXCEEDS_PURCHASED` when the cumulative
 * returned qty would exceed the purchased qty.
 */
export async function returnPurchaseItems(input: ReturnPurchaseInput): Promise<PurchaseReturn> {
  const result = await db.transaction(async (trx) => {
    const purchase = await Purchase.query({ client: trx })
      .where('id', input.purchaseId)
      .forUpdate()
      .firstOrFail()
    if (purchase.status !== 'confirmed') {
      throw new InvalidStateError({
        entity: 'purchase',
        from: purchase.status,
        to: 'returned',
      })
    }

    const lines = await PurchaseItem.query({ client: trx }).where('purchase_id', purchase.id)
    const lineById = new Map(lines.map((l) => [l.id, l]))

    // Prior returned qty per purchase item (across all previous returns).
    const priorRows = lines.length
      ? await PurchaseReturnItem.query({ client: trx })
          .whereIn(
            'purchase_item_id',
            lines.map((l) => l.id)
          )
          .select('purchase_item_id')
          .sum('qty as total_returned')
          .groupBy('purchase_item_id')
      : []
    const alreadyReturned = new Map<number, number>(
      priorRows.map((r) => [r.purchaseItemId, Number(r.$extras.total_returned)])
    )

    // Merge duplicate lines in the request so the availability check covers
    // the whole request, not each line independently.
    const requested = new Map<number, number>()
    for (const l of input.items) {
      requested.set(l.purchaseItemId, (requested.get(l.purchaseItemId) ?? 0) + l.qty)
    }

    const returnLines: { item: PurchaseItem; qty: number; unitCost: number; lineTotal: number }[] =
      []
    for (const [purchaseItemId, qty] of requested) {
      const item = lineById.get(purchaseItemId)
      if (!item) {
        throw new DomainError({
          code: 'RETURN_EXCEEDS_PURCHASED',
          message: `Line #${purchaseItemId} does not belong to purchase ${purchase.number}.`,
        })
      }
      if (item.itemKind !== 'material' && item.itemKind !== 'component') {
        throw new DomainError({
          code: 'RETURN_KIND_NOT_ALLOWED',
          message: 'Machines cannot be returned through a purchase return.',
        })
      }
      const remaining = Number(item.qty) - (alreadyReturned.get(item.id) ?? 0)
      if (qty <= 0 || qty > remaining + 1e-9) {
        throw new DomainError({
          code: 'RETURN_EXCEEDS_PURCHASED',
          message: `Cannot return ${qty}: only ${round2(Math.max(0, remaining))} left returnable on this line.`,
        })
      }
      const unitCost = Number(item.unitCost)
      returnLines.push({ item, qty, unitCost, lineTotal: round2(qty * unitCost) })
    }

    const total = round2(returnLines.reduce((sum, l) => sum + l.lineTotal, 0))
    const number = await nextDocNumber('PRT', trx)

    const ret = new PurchaseReturn()
    ret.number = number
    ret.purchaseId = purchase.id
    ret.supplierId = purchase.supplierId
    ret.total = String(total)
    ret.note = input.note ?? null
    ret.createdByUserId = input.actor.id
    ret.useTransaction(trx)
    await ret.save()

    for (const l of returnLines) {
      const ri = new PurchaseReturnItem()
      ri.purchaseReturnId = ret.id
      ri.purchaseItemId = l.item.id
      ri.itemKind = l.item.itemKind
      ri.itemId = l.item.itemId
      ri.qty = String(l.qty)
      ri.unitCost = String(l.unitCost)
      ri.lineTotal = String(l.lineTotal)
      ri.useTransaction(trx)
      await ri.save()

      // Outbound movement — valued at weighted-average cost by applyMovement.
      await applyMovement({
        itemKind: l.item.itemKind as 'material' | 'component',
        itemId: l.item.itemId,
        qty: -l.qty,
        unitCost: 0,
        reason: 'purchase_return',
        referenceType: 'purchase_return',
        referenceId: ret.id,
        note: null,
        actor: input.actor,
        trx,
      })
    }

    await audit({
      actor: input.actor,
      action: 'purchase.return',
      targetType: 'purchase',
      targetId: purchase.id,
      payload: { number, total, lineCount: returnLines.length },
      trx,
    })

    return ret
  })

  await invalidateSnapshotCache()
  return result
}

export type PurchasePaymentInput = {
  purchaseId: number
  amount: number
  method: 'cash' | 'bank' | 'upi' | 'other'
  reference?: string | null
  note?: string | null
  actor: User
}

/**
 * Record a supplier payment against a confirmed purchase.
 *
 * The payable is the purchase total minus supplier credits from purchase
 * returns; payments may never exceed the remaining balance.
 */
export async function recordPurchasePayment(input: PurchasePaymentInput): Promise<PurchasePayment> {
  return db.transaction(async (trx) => {
    const purchase = await Purchase.query({ client: trx })
      .where('id', input.purchaseId)
      .forUpdate()
      .firstOrFail()
    if (purchase.status !== 'confirmed') {
      throw new InvalidStateError({
        entity: 'purchase',
        from: purchase.status,
        to: 'paid',
      })
    }

    const returnsRow = await PurchaseReturn.query({ client: trx })
      .where('purchase_id', purchase.id)
      .sum('total as returns_total')
      .first()
    const returnsTotal = Number(returnsRow?.$extras.returns_total ?? 0)
    const remaining = round2(Number(purchase.total) - returnsTotal - Number(purchase.paidTotal))
    if (input.amount <= 0 || input.amount > remaining + 0.001) {
      throw new DomainError({
        code: 'PAYMENT_EXCEEDS_DUE',
        message: `Cannot pay ${round2(input.amount)}: remaining balance on ${purchase.number} is ${Math.max(0, remaining)}.`,
      })
    }

    const payment = new PurchasePayment()
    payment.purchaseId = purchase.id
    payment.amount = String(round2(input.amount))
    payment.method = input.method
    payment.paidAt = DateTime.now()
    payment.reference = input.reference ?? null
    payment.note = input.note ?? null
    payment.recordedByUserId = input.actor.id
    payment.useTransaction(trx)
    await payment.save()

    purchase.paidTotal = String(round2(Number(purchase.paidTotal) + input.amount))
    await purchase.save()

    await audit({
      actor: input.actor,
      action: 'purchase.payment',
      targetType: 'purchase',
      targetId: purchase.id,
      payload: { amount: round2(input.amount), method: input.method },
      trx,
    })

    return payment
  })
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
