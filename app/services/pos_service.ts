import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Customer from '#models/customer'
import Product from '#models/product'
import Order from '#models/order'
import OrderItem from '#models/order_item'
import InvoicePayment from '#models/invoice_payment'
import CashSession from '#models/cash_session'
import type User from '#models/user'
import { audit } from '#services/audit'
import { nextDocNumber } from '#services/numbering'
import { generateInvoiceForOrder } from '#services/invoice_service'
import { applyMovement, invalidateSnapshotCache } from '#services/inventory_service'
import { DomainError, InvalidStateError } from '#services/domain_errors'
import { resolveOrderLinePricing } from '#services/pricing'

export type PosLineInput = {
  productId: number
  qty: number
  /** Requested price. Omitted → the server-suggested price is used. */
  unitPrice?: number | null
}

type PaymentMethod = 'cash' | 'bank' | 'upi' | 'other'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Single-transaction POS order: creates the order (confirmed),
 * issues the invoice, and records a full-amount payment.
 *
 * Returns the invoice id so the UI can navigate to the receipt.
 */
export async function completePosOrder(input: {
  customerId: number
  items: PosLineInput[]
  paymentMethod: PaymentMethod
  paymentReference?: string | null
  allowPriceOverride: boolean
  actor: User
}): Promise<{ orderId: number; invoiceId: number; total: number }> {
  if (input.items.length === 0) {
    throw new Error('At least one line is required.')
  }
  for (const it of input.items) {
    if (it.qty <= 0) throw new Error('Quantity must be greater than zero.')
    if (it.unitPrice !== null && it.unitPrice !== undefined && it.unitPrice < 0) {
      throw new Error('Unit price cannot be negative.')
    }
  }

  const customer = await Customer.findOrFail(input.customerId)
  if (!customer.isActive) {
    throw new InvalidStateError({
      entity: 'customer',
      from: 'archived',
      to: 'used in POS order',
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

  // Server-side price enforcement: the unit price and tax rate come from the
  // pricing service; a deviating client price is an override that requires
  // the orders.overridePrice permission and is floored at cost.
  const pricingByLine = await Promise.all(
    input.items.map((it) =>
      resolveOrderLinePricing({
        productId: it.productId,
        requestedUnitPrice: it.unitPrice,
        allowOverride: input.allowPriceOverride,
      })
    )
  )

  const result = await db.transaction(async (trx) => {
    let subtotal = 0
    let taxTotal = 0
    let total = 0
    const lines = input.items.map((l, idx) => {
      const pricing = pricingByLine[idx]
      const ls = round2(l.qty * pricing.unitPrice)
      const lt = round2((ls * pricing.taxRatePct) / 100)
      const lto = round2(ls + lt)
      subtotal += ls
      taxTotal += lt
      total += lto
      const p = productById.get(l.productId)!
      return {
        productId: l.productId,
        qty: l.qty,
        unitPrice: pricing.unitPrice,
        taxRatePct: pricing.taxRatePct,
        description: `${p.name} (${p.sku})`,
        lineSubtotal: ls,
        lineTax: lt,
        lineTotal: lto,
      }
    })

    const now = DateTime.now()

    // Cash sales require an open register; other methods (card/UPI/etc.)
    // are allowed with or without a session, but get tagged onto one when
    // open so the Z-report can show their totals too.
    const openSession = await CashSession.query({ client: trx }).where('status', 'open').first()
    if (input.paymentMethod === 'cash' && !openSession) {
      throw new DomainError({
        code: 'NO_OPEN_CASH_SESSION',
        message: 'Open a cash session before taking cash payments.',
      })
    }

    const order = new Order()
    order.number = await nextDocNumber('ORD', trx)
    order.customerId = input.customerId
    order.quotationId = null
    order.status = 'confirmed'
    order.subtotal = String(round2(subtotal))
    order.taxTotal = String(round2(taxTotal))
    order.total = String(round2(total))
    order.note = 'POS order'
    order.confirmedAt = now
    order.createdByUserId = input.actor.id
    order.useTransaction(trx)
    await order.save()

    for (const l of lines) {
      const item = new OrderItem()
      item.orderId = order.id
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
        reason: 'order',
        referenceType: 'order',
        referenceId: order.id,
        note: null,
        actor: input.actor,
        trx,
      })
    }

    const invoice = await generateInvoiceForOrder(order, input.actor, trx, {
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
    payment.cashSessionId = openSession?.id ?? null
    payment.useTransaction(trx)
    await payment.save()

    invoice.paidTotal = String(round2(total))
    invoice.status = 'paid'
    invoice.useTransaction(trx)
    await invoice.save()

    await audit({
      actor: input.actor,
      action: 'pos.sell',
      targetType: 'order',
      targetId: order.id,
      payload: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        total: round2(total),
        method: input.paymentMethod,
        lineCount: lines.length,
      },
      trx,
    })

    return { orderId: order.id, invoiceId: invoice.id, total: round2(total) }
  })

  await invalidateSnapshotCache()
  return result
}
