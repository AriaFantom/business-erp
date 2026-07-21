import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Order from '#models/order'
import OrderItem from '#models/order_item'
import Quotation from '#models/quotation'
import QuotationItem from '#models/quotation_item'
import Customer from '#models/customer'
import type User from '#models/user'
import { audit } from '#services/audit'
import { nextDocNumber } from '#services/numbering'
import { generateInvoiceForOrder } from '#services/invoice_service'
import { applyMovement, invalidateSnapshotCache } from '#services/inventory_service'
import { DomainError, InvalidStateError } from '#services/domain_errors'
import { resolveOrderLinePricing, type OrderLineInput } from '#services/pricing'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export async function createOrder(input: {
  customerId: number
  quotationId?: number | null
  note?: string | null
  items: OrderLineInput[]
  allowPriceOverride: boolean
  actor: User
}): Promise<Order> {
  const customer = await Customer.findOrFail(input.customerId)
  if (!customer.isActive) {
    throw new InvalidStateError({
      entity: 'customer',
      from: 'archived',
      to: 'used in order',
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
      const pricing = await resolveOrderLinePricing({
        productId: l.productId,
        requestedUnitPrice: l.unitPrice,
        allowOverride: input.allowPriceOverride,
      })
      return { ...l, unitPrice: pricing.unitPrice, taxRatePct: pricing.taxRatePct }
    })
  )

  return db.transaction(async (trx) => {
    const number = await nextDocNumber('ORD', trx)
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

    const order = new Order()
    order.number = number
    order.customerId = input.customerId
    order.quotationId = input.quotationId ?? null
    order.status = 'draft'
    order.subtotal = String(round2(subtotal))
    order.taxTotal = String(round2(tax))
    order.total = String(round2(total))
    order.note = input.note ?? null
    order.createdByUserId = input.actor.id
    order.useTransaction(trx)
    await order.save()

    for (const l of lines) {
      const item = new OrderItem()
      item.orderId = order.id
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
      action: 'order.create',
      targetType: 'order',
      targetId: order.id,
      payload: { number, customerId: input.customerId, total },
      trx,
    })
    return order
  })
}

/**
 * Convert an accepted quotation into a draft order, copying lines and
 * marking the quotation as 'converted'. Done in a single transaction.
 */
export async function convertQuotationToOrder(quotationId: number, actor: User): Promise<Order> {
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
    const number = await nextDocNumber('ORD', trx)

    const order = new Order()
    order.number = number
    order.customerId = q.customerId
    order.quotationId = q.id
    order.status = 'draft'
    order.subtotal = q.subtotal
    order.taxTotal = q.taxTotal
    order.total = q.total
    order.note = q.note
    order.createdByUserId = actor.id
    order.useTransaction(trx)
    await order.save()

    for (const it of items) {
      const oi = new OrderItem()
      oi.orderId = order.id
      oi.productId = it.productId
      oi.description = it.description
      oi.qty = it.qty
      oi.unitPrice = it.unitPrice
      oi.taxRatePct = it.taxRatePct
      oi.lineSubtotal = it.lineSubtotal
      oi.lineTax = it.lineTax
      oi.lineTotal = it.lineTotal
      oi.useTransaction(trx)
      await oi.save()
    }

    q.status = 'converted'
    q.convertedToOrderId = order.id
    await q.save()

    await audit({
      actor,
      action: 'quotation.convert',
      targetType: 'quotation',
      targetId: q.id,
      payload: { orderId: order.id, orderNumber: order.number },
      trx,
    })
    return order
  })
}

/**
 * Confirm a draft order; this also issues the invoice in the same transaction.
 * Returns the confirmed order (the invoice id is on the invoice itself).
 */
export async function confirmOrder(orderId: number, actor: User): Promise<Order> {
  const result = await db.transaction(async (trx) => {
    const order = await Order.query({ client: trx }).where('id', orderId).forUpdate().firstOrFail()
    if (order.status !== 'draft') {
      throw new InvalidStateError({
        entity: 'order',
        from: order.status,
        to: 'confirmed',
      })
    }

    // Credit-limit gate: block confirmation when the customer's open
    // receivable plus this order would exceed their limit (null = no limit).
    // POS is unaffected — it pays in full immediately and never calls this.
    const customer = await Customer.query({ client: trx })
      .where('id', order.customerId)
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
      const orderTotal = Number(order.total)
      if (openBalance + orderTotal > limit + 0.001) {
        throw new DomainError({
          code: 'CREDIT_LIMIT_EXCEEDED',
          message: `Credit limit exceeded for ${customer.name}: limit ${limit.toFixed(2)}, open balance ${openBalance.toFixed(2)}, this order ${orderTotal.toFixed(2)}.`,
        })
      }
    }

    // Deduct stock for every line that points at a real product. Free-form
    // lines (productId = null) bypass inventory. applyMovement locks the
    // inventory row and throws InsufficientStockError on negative outcomes.
    const items = await OrderItem.query({ client: trx }).where('order_id', orderId)
    for (const it of items) {
      if (!it.productId) continue
      await applyMovement({
        itemKind: 'product',
        itemId: it.productId,
        qty: -Number(it.qty),
        unitCost: Number(it.unitPrice),
        reason: 'order',
        referenceType: 'order',
        referenceId: order.id,
        note: null,
        actor,
        trx,
      })
    }

    order.status = 'confirmed'
    order.confirmedAt = DateTime.now()
    await order.save()

    await generateInvoiceForOrder(order, actor, trx)

    await audit({
      actor,
      action: 'order.confirm',
      targetType: 'order',
      targetId: order.id,
      payload: { number: order.number },
      trx,
    })
    return order
  })

  await invalidateSnapshotCache()
  return result
}

export async function cancelOrder(orderId: number, actor: User): Promise<Order> {
  return db.transaction(async (trx) => {
    const order = await Order.query({ client: trx }).where('id', orderId).forUpdate().firstOrFail()
    if (order.status !== 'draft') {
      throw new InvalidStateError({
        entity: 'order',
        from: order.status,
        to: 'cancelled',
      })
    }
    order.status = 'cancelled'
    await order.save()
    await audit({
      actor,
      action: 'order.cancel',
      targetType: 'order',
      targetId: order.id,
      trx,
    })
    return order
  })
}
