import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Customer from '#models/customer'
import Product from '#models/product'
import Sale from '#models/sale'
import SaleItem from '#models/sale_item'
import InvoicePayment from '#models/invoice_payment'
import type User from '#models/user'
import { audit } from '#services/audit'
import { nextDocNumber } from '#services/numbering'
import { generateInvoiceForSale } from '#services/invoice_service'
import { applyMovement, invalidateSnapshotCache } from '#services/inventory_service'
import { InvalidStateError } from '#services/domain_errors'

export type PosLineInput = {
  productId: number
  qty: number
  unitPrice: number
  taxRatePct: number
}

type PaymentMethod = 'cash' | 'bank' | 'upi' | 'other'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Single-transaction POS sale: creates the sale (confirmed),
 * issues the invoice, and records a full-amount payment.
 *
 * Returns the invoice id so the UI can navigate to the receipt.
 */
export async function completePosSale(input: {
  customerId: number
  items: PosLineInput[]
  paymentMethod: PaymentMethod
  paymentReference?: string | null
  actor: User
}): Promise<{ saleId: number; invoiceId: number; total: number }> {
  if (input.items.length === 0) {
    throw new Error('At least one line is required.')
  }
  for (const it of input.items) {
    if (it.qty <= 0) throw new Error('Quantity must be greater than zero.')
    if (it.unitPrice < 0) throw new Error('Unit price cannot be negative.')
  }

  const customer = await Customer.findOrFail(input.customerId)
  if (!customer.isActive) {
    throw new InvalidStateError({
      entity: 'customer',
      from: 'archived',
      to: 'used in POS sale',
    })
  }

  const productIds = [...new Set(input.items.map((i) => i.productId))]
  const products = await Product.query().whereIn('id', productIds)
  const productById = new Map(products.map((p) => [p.id, p]))
  for (const it of input.items) {
    const p = productById.get(it.productId)
    if (!p) throw new Error(`Product ${it.productId} not found.`)
    if (!p.isActive) throw new Error(`Product "${p.name}" is archived.`)
  }

  const result = await db.transaction(async (trx) => {
    let subtotal = 0
    let taxTotal = 0
    let total = 0
    const lines = input.items.map((l) => {
      const ls = round2(l.qty * l.unitPrice)
      const lt = round2((ls * l.taxRatePct) / 100)
      const lto = round2(ls + lt)
      subtotal += ls
      taxTotal += lt
      total += lto
      const p = productById.get(l.productId)!
      return {
        ...l,
        description: `${p.name} (${p.sku})`,
        lineSubtotal: ls,
        lineTax: lt,
        lineTotal: lto,
      }
    })

    const now = DateTime.now()

    const sale = new Sale()
    sale.number = await nextDocNumber('SO', trx)
    sale.customerId = input.customerId
    sale.quotationId = null
    sale.status = 'confirmed'
    sale.subtotal = String(round2(subtotal))
    sale.taxTotal = String(round2(taxTotal))
    sale.total = String(round2(total))
    sale.note = 'POS sale'
    sale.confirmedAt = now
    sale.createdByUserId = input.actor.id
    sale.useTransaction(trx)
    await sale.save()

    for (const l of lines) {
      const item = new SaleItem()
      item.saleId = sale.id
      item.productId = l.productId
      item.description = l.description
      item.qty = l.qty
      item.unitPrice = String(l.unitPrice)
      item.taxRatePct = String(l.taxRatePct)
      item.lineSubtotal = String(l.lineSubtotal)
      item.lineTax = String(l.lineTax)
      item.lineTotal = String(l.lineTotal)
      item.useTransaction(trx)
      await item.save()

      // Deduct stock for the sold product. applyMovement locks the inventory
      // row and throws InsufficientStockError if qty would go negative.
      await applyMovement({
        itemKind: 'product',
        itemId: l.productId,
        qty: -l.qty,
        unitCost: l.unitPrice,
        reason: 'sale',
        referenceType: 'sale',
        referenceId: sale.id,
        note: null,
        actor: input.actor,
        trx,
      })
    }

    const invoice = await generateInvoiceForSale(sale, input.actor, trx, {
      issuedAt: now,
      dueAt: now,
    })

    const payment = new InvoicePayment()
    payment.invoiceId = invoice.id
    payment.amount = String(round2(total))
    payment.method = input.paymentMethod
    payment.paidAt = now
    payment.reference = input.paymentReference ?? null
    payment.recordedByUserId = input.actor.id
    payment.useTransaction(trx)
    await payment.save()

    invoice.paidTotal = String(round2(total))
    invoice.status = 'paid'
    invoice.useTransaction(trx)
    await invoice.save()

    await audit({
      actor: input.actor,
      action: 'pos.sell',
      targetType: 'sale',
      targetId: sale.id,
      payload: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        total: round2(total),
        method: input.paymentMethod,
        lineCount: lines.length,
      },
      trx,
    })

    return { saleId: sale.id, invoiceId: invoice.id, total: round2(total) }
  })

  await invalidateSnapshotCache()
  return result
}
