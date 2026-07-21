import db from '@adonisjs/lucid/services/db'
import Order from '#models/order'
import OrderItem from '#models/order_item'
import OrderReturn from '#models/order_return'
import OrderReturnItem from '#models/order_return_item'
import Invoice from '#models/invoice'
import StockMovement from '#models/stock_movement'
import type User from '#models/user'
import { applyMovement, invalidateSnapshotCache } from '#services/inventory_service'
import { audit } from '#services/audit'
import { nextDocNumber } from '#services/numbering'
import { DomainError, InvalidStateError } from '#services/domain_errors'
import { invalidatePdf } from '#services/document_pdf/render'

export type RefundMethod = 'cash' | 'bank' | 'upi' | 'other'

export type CreateOrderReturnInput = {
  orderId: number
  items: { orderItemId: number; qty: number }[]
  refundMethod?: RefundMethod | null
  note?: string | null
  actor: User
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Return sold items and issue a credit note (CN scope).
 *
 * - Stock goes back in at the COGS the original order movement recorded, so
 *   the return reverses the order's inventory valuation, not the sale price.
 * - Settlement: the return total is first applied as credit against the
 *   linked invoice's remaining due; any excess must be refunded (refund
 *   method required in that case).
 */
export async function createOrderReturn(input: CreateOrderReturnInput): Promise<OrderReturn> {
  const result = await db.transaction(async (trx) => {
    const order = await Order.query({ client: trx })
      .where('id', input.orderId)
      .forUpdate()
      .firstOrFail()
    if (order.status !== 'confirmed') {
      throw new InvalidStateError({
        entity: 'order',
        from: order.status,
        to: 'returned',
      })
    }

    const items = await OrderItem.query({ client: trx }).where('order_id', order.id)
    const itemById = new Map(items.map((i) => [i.id, i]))

    const invoice = await Invoice.query({ client: trx })
      .where('order_id', order.id)
      .forUpdate()
      .first()

    // Prior returned qty per order item (across all previous credit notes).
    const priorRows = items.length
      ? await OrderReturnItem.query({ client: trx })
          .whereIn(
            'order_item_id',
            items.map((i) => i.id)
          )
          .select('order_item_id')
          .sum('qty as total_returned')
          .groupBy('order_item_id')
      : []
    const alreadyReturned = new Map<number, number>(
      priorRows.map((r) => [r.orderItemId, Number(r.$extras.total_returned)])
    )

    // Merge duplicate lines in the request so the availability check covers
    // the whole request, not each line independently.
    const requested = new Map<number, number>()
    for (const l of input.items) {
      requested.set(l.orderItemId, (requested.get(l.orderItemId) ?? 0) + l.qty)
    }

    const returnLines: {
      item: OrderItem
      qty: number
      lineSubtotal: number
      lineTax: number
      lineTotal: number
    }[] = []
    for (const [orderItemId, qty] of requested) {
      const item = itemById.get(orderItemId)
      if (!item) {
        throw new DomainError({
          code: 'RETURN_EXCEEDS_SOLD',
          message: `Line #${orderItemId} does not belong to order ${order.number}.`,
        })
      }
      const remaining = Number(item.qty) - (alreadyReturned.get(item.id) ?? 0)
      if (qty <= 0 || qty > remaining) {
        throw new DomainError({
          code: 'RETURN_EXCEEDS_SOLD',
          message: `Cannot return ${qty}: only ${Math.max(0, remaining)} left returnable on this line.`,
        })
      }
      const unitPrice = Number(item.unitPrice)
      const taxRatePct = Number(item.taxRatePct)
      const lineSubtotal = round2(qty * unitPrice)
      const lineTax = round2((lineSubtotal * taxRatePct) / 100)
      returnLines.push({
        item,
        qty,
        lineSubtotal,
        lineTax,
        lineTotal: round2(lineSubtotal + lineTax),
      })
    }

    const subtotal = round2(returnLines.reduce((s, l) => s + l.lineSubtotal, 0))
    const taxTotal = round2(returnLines.reduce((s, l) => s + l.lineTax, 0))
    const total = round2(returnLines.reduce((s, l) => s + l.lineTotal, 0))

    // Settlement: apply the return as credit against the invoice's remaining
    // due first; anything beyond that has to be refunded to the customer.
    let creditApplied = 0
    if (invoice && invoice.status !== 'void') {
      const remainingDue = round2(
        Number(invoice.total) - Number(invoice.paidTotal) - Number(invoice.creditTotal)
      )
      creditApplied = Math.min(total, Math.max(0, remainingDue))
    }
    const refundAmount = round2(total - creditApplied)
    if (refundAmount > 0 && !input.refundMethod) {
      throw new DomainError({
        code: 'REFUND_METHOD_REQUIRED',
        field: 'refundMethod',
        message: `A refund of ${refundAmount.toFixed(2)} is owed — choose a refund method.`,
      })
    }

    const number = await nextDocNumber('CN', trx)

    const ret = new OrderReturn()
    ret.number = number
    ret.orderId = order.id
    ret.invoiceId = invoice?.id ?? null
    ret.customerId = order.customerId
    ret.subtotal = String(subtotal)
    ret.taxTotal = String(taxTotal)
    ret.total = String(total)
    ret.creditApplied = String(round2(creditApplied))
    ret.refundAmount = String(refundAmount)
    ret.refundMethod = refundAmount > 0 ? (input.refundMethod ?? null) : null
    ret.note = input.note ?? null
    ret.createdByUserId = input.actor.id
    ret.useTransaction(trx)
    await ret.save()

    for (const l of returnLines) {
      const ri = new OrderReturnItem()
      ri.orderReturnId = ret.id
      ri.orderItemId = l.item.id
      ri.productId = l.item.productId
      ri.description = l.item.description
      ri.qty = l.qty
      ri.unitPrice = l.item.unitPrice
      ri.taxRatePct = l.item.taxRatePct
      ri.lineSubtotal = String(l.lineSubtotal)
      ri.lineTax = String(l.lineTax)
      ri.lineTotal = String(l.lineTotal)
      ri.useTransaction(trx)
      await ri.save()

      // Stock back in for real products, at the COGS the original outbound
      // order movement was valued at (fallback 0 if the movement is missing).
      if (l.item.productId) {
        const orderMove = await StockMovement.query({ client: trx })
          .where('reason', 'order')
          .where('reference_type', 'order')
          .where('reference_id', order.id)
          .where('item_kind', 'product')
          .where('item_id', l.item.productId)
          .orderBy('id', 'asc')
          .first()
        await applyMovement({
          itemKind: 'product',
          itemId: l.item.productId,
          qty: l.qty,
          unitCost: orderMove ? Number(orderMove.unitCost) : 0,
          reason: 'order_return',
          referenceType: 'order_return',
          referenceId: ret.id,
          note: null,
          actor: input.actor,
          trx,
        })
      }
    }

    if (invoice && invoice.status !== 'void' && creditApplied > 0) {
      const newCredit = round2(Number(invoice.creditTotal) + creditApplied)
      invoice.creditTotal = String(newCredit)
      const paid = Number(invoice.paidTotal)
      invoice.status =
        paid + newCredit >= Number(invoice.total) - 0.001
          ? 'paid'
          : paid > 0 || newCredit > 0
            ? 'partial'
            : 'unpaid'
      await invoice.save()
      await invalidatePdf(invoice)
    }

    await audit({
      actor: input.actor,
      action: 'order.return',
      targetType: 'order',
      targetId: order.id,
      payload: { creditNote: number, creditApplied: round2(creditApplied), refundAmount },
      trx,
    })

    return ret
  })

  await invalidateSnapshotCache()
  return result
}
