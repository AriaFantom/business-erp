import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Sale from '#models/sale'
import SaleItem from '#models/sale_item'
import Quotation from '#models/quotation'
import QuotationItem from '#models/quotation_item'
import Customer from '#models/customer'
import type User from '#models/user'
import { audit } from '#services/audit'
import { nextDocNumber } from '#services/numbering'
import { generateInvoiceForSale } from '#services/invoice_service'
import { applyMovement, invalidateSnapshotCache } from '#services/inventory_service'
import { DomainError, InvalidStateError } from '#services/domain_errors'
import { resolveSaleLinePricing } from '#services/pricing'

export type SaleLineInput = {
  productId?: number | null
  description: string
  qty: number
  unitPrice: number
  taxRatePct: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export async function createSale(input: {
  customerId: number
  quotationId?: number | null
  note?: string | null
  items: SaleLineInput[]
  allowPriceOverride: boolean
  actor: User
}): Promise<Sale> {
  const customer = await Customer.findOrFail(input.customerId)
  if (!customer.isActive) {
    throw new InvalidStateError({
      entity: 'customer',
      from: 'archived',
      to: 'used in sale',
    })
  }
  if (input.items.length === 0) {
    throw new Error('At least one line is required.')
  }
  for (const it of input.items) {
    if (it.qty <= 0) throw new Error('Quantity must be greater than zero.')
    if (it.unitPrice < 0) throw new Error('Unit price cannot be negative.')
  }

  // Server-side price enforcement for product lines. Free-form lines have
  // nothing to price them from, so their manual unitPrice/taxRatePct stand
  // (same convention as quotation buildLine).
  const pricedItems = await Promise.all(
    input.items.map(async (l) => {
      if (!l.productId) return l
      const pricing = await resolveSaleLinePricing({
        productId: l.productId,
        requestedUnitPrice: l.unitPrice,
        allowOverride: input.allowPriceOverride,
      })
      return { ...l, unitPrice: pricing.unitPrice, taxRatePct: pricing.taxRatePct }
    })
  )

  return db.transaction(async (trx) => {
    const number = await nextDocNumber('SO', trx)
    let subtotal = 0
    let tax = 0
    let total = 0
    const lines = pricedItems.map((l) => {
      const ls = round2(l.qty * l.unitPrice)
      const lt = round2((ls * l.taxRatePct) / 100)
      const lto = round2(ls + lt)
      subtotal += ls
      tax += lt
      total += lto
      return { ...l, lineSubtotal: ls, lineTax: lt, lineTotal: lto }
    })

    const sale = new Sale()
    sale.number = number
    sale.customerId = input.customerId
    sale.quotationId = input.quotationId ?? null
    sale.status = 'draft'
    sale.subtotal = String(round2(subtotal))
    sale.taxTotal = String(round2(tax))
    sale.total = String(round2(total))
    sale.note = input.note ?? null
    sale.createdByUserId = input.actor.id
    sale.useTransaction(trx)
    await sale.save()

    for (const l of lines) {
      const item = new SaleItem()
      item.saleId = sale.id
      item.productId = l.productId ?? null
      item.description = l.description
      item.qty = l.qty
      item.unitPrice = String(l.unitPrice)
      item.taxRatePct = String(l.taxRatePct)
      item.lineSubtotal = String(l.lineSubtotal)
      item.lineTax = String(l.lineTax)
      item.lineTotal = String(l.lineTotal)
      item.useTransaction(trx)
      await item.save()
    }

    await audit({
      actor: input.actor,
      action: 'sale.create',
      targetType: 'sale',
      targetId: sale.id,
      payload: { number, customerId: input.customerId, total },
      trx,
    })
    return sale
  })
}

/**
 * Convert an accepted quotation into a draft sale, copying lines and
 * marking the quotation as 'converted'. Done in a single transaction.
 */
export async function convertQuotationToSale(quotationId: number, actor: User): Promise<Sale> {
  return db.transaction(async (trx) => {
    const q = await Quotation.query({ client: trx })
      .where('id', quotationId)
      .forUpdate()
      .firstOrFail()
    if (q.status !== 'accepted') {
      throw new InvalidStateError({
        entity: 'quotation',
        from: q.status,
        to: 'converted',
      })
    }

    const items = await QuotationItem.query({ client: trx }).where('quotation_id', quotationId)
    const number = await nextDocNumber('SO', trx)

    const sale = new Sale()
    sale.number = number
    sale.customerId = q.customerId
    sale.quotationId = q.id
    sale.status = 'draft'
    sale.subtotal = q.subtotal
    sale.taxTotal = q.taxTotal
    sale.total = q.total
    sale.note = q.note
    sale.createdByUserId = actor.id
    sale.useTransaction(trx)
    await sale.save()

    for (const it of items) {
      const si = new SaleItem()
      si.saleId = sale.id
      si.productId = it.productId
      si.description = it.description
      si.qty = it.qty
      si.unitPrice = it.unitPrice
      si.taxRatePct = it.taxRatePct
      si.lineSubtotal = it.lineSubtotal
      si.lineTax = it.lineTax
      si.lineTotal = it.lineTotal
      si.useTransaction(trx)
      await si.save()
    }

    q.status = 'converted'
    q.convertedToSaleId = sale.id
    await q.save()

    await audit({
      actor,
      action: 'quotation.convert',
      targetType: 'quotation',
      targetId: q.id,
      payload: { saleId: sale.id, saleNumber: sale.number },
      trx,
    })
    return sale
  })
}

/**
 * Confirm a draft sale; this also issues the invoice in the same transaction.
 * Returns the confirmed sale (the invoice id is on the invoice itself).
 */
export async function confirmSale(saleId: number, actor: User): Promise<Sale> {
  const result = await db.transaction(async (trx) => {
    const sale = await Sale.query({ client: trx }).where('id', saleId).forUpdate().firstOrFail()
    if (sale.status !== 'draft') {
      throw new InvalidStateError({
        entity: 'sale',
        from: sale.status,
        to: 'confirmed',
      })
    }

    // Credit-limit gate: block confirmation when the customer's open
    // receivable plus this sale would exceed their limit (null = no limit).
    // POS is unaffected — it pays in full immediately and never calls this.
    const customer = await Customer.query({ client: trx })
      .where('id', sale.customerId)
      .firstOrFail()
    if (customer.creditLimit !== null) {
      const limit = Number(customer.creditLimit)
      const balanceRow = await trx
        .from('invoices')
        .where('customer_id', customer.id)
        .whereNot('status', 'void')
        .select(trx.raw('COALESCE(SUM(total - paid_total - credit_total), 0) as balance'))
        .first()
      const openBalance = Math.max(0, Number(balanceRow?.balance ?? 0))
      const saleTotal = Number(sale.total)
      if (openBalance + saleTotal > limit + 0.001) {
        throw new DomainError({
          code: 'CREDIT_LIMIT_EXCEEDED',
          message: `Credit limit exceeded for ${customer.name}: limit ${limit.toFixed(2)}, open balance ${openBalance.toFixed(2)}, this sale ${saleTotal.toFixed(2)}.`,
        })
      }
    }

    // Deduct stock for every line that points at a real product. Free-form
    // lines (productId = null) bypass inventory. applyMovement locks the
    // inventory row and throws InsufficientStockError on negative outcomes.
    const items = await SaleItem.query({ client: trx }).where('sale_id', saleId)
    for (const it of items) {
      if (!it.productId) continue
      await applyMovement({
        itemKind: 'product',
        itemId: it.productId,
        qty: -Number(it.qty),
        unitCost: Number(it.unitPrice),
        reason: 'sale',
        referenceType: 'sale',
        referenceId: sale.id,
        note: null,
        actor,
        trx,
      })
    }

    sale.status = 'confirmed'
    sale.confirmedAt = DateTime.now()
    await sale.save()

    await generateInvoiceForSale(sale, actor, trx)

    await audit({
      actor,
      action: 'sale.confirm',
      targetType: 'sale',
      targetId: sale.id,
      payload: { number: sale.number },
      trx,
    })
    return sale
  })

  await invalidateSnapshotCache()
  return result
}

export async function cancelSale(saleId: number, actor: User): Promise<Sale> {
  return db.transaction(async (trx) => {
    const sale = await Sale.query({ client: trx }).where('id', saleId).forUpdate().firstOrFail()
    if (sale.status !== 'draft') {
      throw new InvalidStateError({
        entity: 'sale',
        from: sale.status,
        to: 'cancelled',
      })
    }
    sale.status = 'cancelled'
    await sale.save()
    await audit({
      actor,
      action: 'sale.cancel',
      targetType: 'sale',
      targetId: sale.id,
      trx,
    })
    return sale
  })
}
