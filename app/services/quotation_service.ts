import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Quotation from '#models/quotation'
import QuotationItem from '#models/quotation_item'
import Customer from '#models/customer'
import Product from '#models/product'
import ProductCategory from '#models/product_category'
import type User from '#models/user'
import { audit } from '#services/audit'
import { nextDocNumber } from '#services/numbering'
import { computeUnitPrice } from '#services/pricing'
import { latestProductCost } from '#services/job_costing'
import { InvalidStateError } from '#services/domain_errors'

export type QuotationLineInput = {
  productId?: number | null
  description: string
  qty: number
  /** Manual override; if null/undefined the pricing service derives it. */
  unitPrice?: number | null
  taxRatePct?: number | null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

async function buildLine(input: QuotationLineInput) {
  let unitPrice: number
  let profitPctUsed: number | null = null
  let taxRatePct: number = input.taxRatePct ?? 0

  if (input.productId) {
    const product = await Product.findOrFail(input.productId)
    const category = product.categoryId ? await ProductCategory.find(product.categoryId) : null
    const cost = await latestProductCost(input.productId)
    const breakdown = computeUnitPrice({
      costPrice: cost,
      manualUnitPrice: input.unitPrice ?? null,
      product,
      category,
    })
    unitPrice = breakdown.unitPrice
    profitPctUsed = breakdown.profitPctUsed
    taxRatePct = input.taxRatePct ?? breakdown.taxRatePct
  } else {
    if (input.unitPrice === null || input.unitPrice === undefined) {
      throw new Error('Custom (non-product) lines require a manual unit price.')
    }
    unitPrice = input.unitPrice
  }

  const subtotal = round2(unitPrice * input.qty)
  const tax = round2((subtotal * taxRatePct) / 100)
  const total = round2(subtotal + tax)
  return {
    productId: input.productId ?? null,
    description: input.description,
    qty: input.qty,
    unitPrice,
    profitPctUsed,
    taxRatePct,
    lineSubtotal: subtotal,
    lineTax: tax,
    lineTotal: total,
  }
}

export async function createQuotation(input: {
  customerId: number
  validUntil: DateTime
  note?: string | null
  items: QuotationLineInput[]
  actor: User
}): Promise<Quotation> {
  const customer = await Customer.findOrFail(input.customerId)
  if (!customer.isActive) {
    throw new InvalidStateError({
      entity: 'customer',
      from: 'archived',
      to: 'used in quotation',
    })
  }
  const builtLines = await Promise.all(input.items.map(buildLine))

  return db.transaction(async (trx) => {
    const number = await nextDocNumber('QT', trx)

    const subtotal = builtLines.reduce((s, l) => s + l.lineSubtotal, 0)
    const tax = builtLines.reduce((s, l) => s + l.lineTax, 0)
    const total = builtLines.reduce((s, l) => s + l.lineTotal, 0)

    const quotation = new Quotation()
    quotation.number = number
    quotation.customerId = input.customerId
    quotation.status = 'draft'
    quotation.issuedAt = DateTime.now()
    quotation.validUntil = input.validUntil
    quotation.subtotal = String(round2(subtotal))
    quotation.taxTotal = String(round2(tax))
    quotation.total = String(round2(total))
    quotation.note = input.note ?? null
    quotation.createdByUserId = input.actor.id
    quotation.useTransaction(trx)
    await quotation.save()

    for (const l of builtLines) {
      const item = new QuotationItem()
      item.quotationId = quotation.id
      item.productId = l.productId
      item.description = l.description
      item.qty = l.qty
      item.unitPrice = String(l.unitPrice)
      item.profitPctUsed = l.profitPctUsed !== null ? String(l.profitPctUsed) : null
      item.taxRatePct = String(l.taxRatePct)
      item.lineSubtotal = String(l.lineSubtotal)
      item.lineTax = String(l.lineTax)
      item.lineTotal = String(l.lineTotal)
      item.useTransaction(trx)
      await item.save()
    }

    await audit({
      actor: input.actor,
      action: 'quotation.create',
      targetType: 'quotation',
      targetId: quotation.id,
      payload: { number, customerId: input.customerId },
      trx,
    })

    return quotation
  })
}

async function transitionStatus(
  id: number,
  expected: string[],
  next: string,
  patch: (q: Quotation) => void,
  actor: User,
  action: string
): Promise<Quotation> {
  return db.transaction(async (trx) => {
    const q = await Quotation.query({ client: trx }).where('id', id).forUpdate().firstOrFail()
    if (!expected.includes(q.status)) {
      throw new InvalidStateError({ entity: 'quotation', from: q.status, to: next })
    }
    q.status = next
    patch(q)
    await q.save()
    await audit({
      actor,
      action,
      targetType: 'quotation',
      targetId: q.id,
      trx,
    })
    return q
  })
}

export const sendQuotation = (id: number, actor: User) =>
  transitionStatus(
    id,
    ['draft'],
    'sent',
    (q) => {
      q.sentAt = DateTime.now()
    },
    actor,
    'quotation.send'
  )

export const acceptQuotation = (id: number, actor: User) =>
  transitionStatus(
    id,
    ['sent'],
    'accepted',
    (q) => {
      q.acceptedAt = DateTime.now()
    },
    actor,
    'quotation.accept'
  )

export const rejectQuotation = (id: number, actor: User) =>
  transitionStatus(
    id,
    ['sent'],
    'rejected',
    (q) => {
      q.rejectedAt = DateTime.now()
    },
    actor,
    'quotation.reject'
  )

/** Bulk-expire all sent quotations whose valid_until has passed. */
export async function expireOverdueQuotations(now: DateTime = DateTime.now()): Promise<number> {
  const overdue = await Quotation.query()
    .where('status', 'sent')
    .where('valid_until', '<', now.toSQL()!)
  for (const q of overdue) {
    q.status = 'expired'
    await q.save()
  }
  return overdue.length
}
