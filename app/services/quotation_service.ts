import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Quotation from '#models/quotation'
import QuotationItem from '#models/quotation_item'
import QuotationItemBom from '#models/quotation_item_bom'
import Customer from '#models/customer'
import Product from '#models/product'
import ProductCategory from '#models/product_category'
import ProductRecipe from '#models/product_recipe'
import Material from '#models/material'
import Component from '#models/component'
import type User from '#models/user'
import { audit } from '#services/audit'
import { nextDocNumber } from '#services/numbering'
import { computeUnitPrice } from '#services/pricing'
import { latestProductCost } from '#services/job_costing'
import { InvalidStateError } from '#services/domain_errors'
import { invalidatePdf } from '#services/document_pdf/render'

export type BomLineInput = {
  itemKind: 'material' | 'component'
  itemId: number
  qty: number
}

export type QuotationLineInput = {
  productId?: number | null
  name: string
  qty: number
  /** Manual override; if null/undefined the pricing service derives it. */
  unitPrice?: number | null
  /** When set on a product line, recompute unit price as cost*(1+x/100) and skip the layered ladder. When set on a custom line, persisted as profitPctUsed for record-keeping. */
  profitPctOverride?: number | null
  taxRatePct?: number | null
  boms?: BomLineInput[]
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

async function buildLine(input: QuotationLineInput) {
  let unitPrice: number
  let profitPctUsed: number | null = null
  let taxRatePct: number = input.taxRatePct ?? 0
  let bomCost = 0
  const bomSnapshots: {
    itemKind: 'material' | 'component'
    itemId: number
    qty: number
    unitCost: number
  }[] = []

  if (input.productId) {
    const product = await Product.findOrFail(input.productId)
    const category = product.categoryId ? await ProductCategory.find(product.categoryId) : null
    const cost = await latestProductCost(input.productId)

    if (
      input.profitPctOverride !== null &&
      input.profitPctOverride !== undefined &&
      (input.unitPrice === null || input.unitPrice === undefined)
    ) {
      const baseCost = cost ?? 0
      unitPrice = round2(baseCost * (1 + input.profitPctOverride / 100))
      profitPctUsed = input.profitPctOverride
      taxRatePct = input.taxRatePct ?? Number(product.taxRatePct ?? category?.taxRatePct ?? 0)
    } else {
      const breakdown = computeUnitPrice({
        costPrice: cost,
        manualUnitPrice: input.unitPrice ?? null,
        product,
        category,
      })
      unitPrice = breakdown.unitPrice
      profitPctUsed = breakdown.profitPctUsed
      taxRatePct = input.taxRatePct ?? breakdown.taxRatePct
    }
  } else {
    // Custom line: if BOM entries are provided, calculate cost from them.
    if (input.boms && input.boms.length > 0) {
      const materialIds = input.boms.filter((b) => b.itemKind === 'material').map((b) => b.itemId)
      const componentIds = input.boms.filter((b) => b.itemKind === 'component').map((b) => b.itemId)

      const [materials, components] = await Promise.all([
        materialIds.length ? Material.query().whereIn('id', materialIds) : [],
        componentIds.length ? Component.query().whereIn('id', componentIds) : [],
      ])
      const matById = new Map(materials.map((m) => [m.id, Number(m.defaultUnitCost)]))
      const compById = new Map(components.map((c) => [c.id, Number(c.defaultUnitCost)]))

      for (const b of input.boms) {
        const unitCost =
          b.itemKind === 'material' ? (matById.get(b.itemId) ?? 0) : (compById.get(b.itemId) ?? 0)
        bomCost += b.qty * unitCost
        bomSnapshots.push({ itemKind: b.itemKind, itemId: b.itemId, qty: b.qty, unitCost })
      }

      const profitPct = input.profitPctOverride ?? 0
      unitPrice = round2(bomCost * (1 + profitPct / 100))
      profitPctUsed = profitPct
    } else if (input.unitPrice === null || input.unitPrice === undefined) {
      throw new Error('Custom (non-product) lines require a manual unit price or BOM entries.')
    } else {
      unitPrice = input.unitPrice
      profitPctUsed = input.profitPctOverride ?? null
    }
  }

  const subtotal = round2(unitPrice * input.qty)
  const tax = round2((subtotal * taxRatePct) / 100)
  const total = round2(subtotal + tax)
  return {
    productId: input.productId ?? null,
    name: input.name,
    qty: input.qty,
    unitPrice,
    profitPctUsed,
    taxRatePct,
    lineSubtotal: subtotal,
    lineTax: tax,
    lineTotal: total,
    bomSnapshots,
    boms: input.boms ?? [],
  }
}

async function generateCustomSku(trx: any): Promise<string> {
  const now = DateTime.now()
  const datePart = now.toFormat('yyyyMMdd')
  const prefix = `CUST-${datePart}`
  const last = await Product.query({ client: trx })
    .whereILike('sku', `${prefix}-%`)
    .orderBy('sku', 'desc')
    .first()
  let seq = 1
  if (last) {
    const parts = last.sku.split('-')
    const lastSeq = Number(parts[parts.length - 1])
    if (!Number.isNaN(lastSeq)) seq = lastSeq + 1
  }
  return `${prefix}-${String(seq).padStart(3, '0')}`
}

async function createCustomProductFromLine(
  line: Awaited<ReturnType<typeof buildLine>>,
  trx: any
): Promise<number> {
  const customCategory = await ProductCategory.query({ client: trx })
    .where('name', 'Custom Orders')
    .first()

  const sku = await generateCustomSku(trx)
  const product = new Product()
  product.sku = sku
  product.name = line.name
  product.description = null
  product.categoryId = customCategory?.id ?? null
  product.isActive = true
  product.useTransaction(trx)
  await product.save()

  // Store BOM entries as product recipe for future jobs
  if (line.boms && line.boms.length > 0) {
    for (const bom of line.boms) {
      const recipe = new ProductRecipe()
      recipe.productId = product.id
      recipe.itemKind = bom.itemKind
      recipe.itemId = bom.itemId
      recipe.qtyPerUnit = String(bom.qty)
      recipe.useTransaction(trx)
      await recipe.save()
    }
  }

  return product.id
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
      let productId = l.productId

      // If this is a custom line with a name, create a custom product
      if (!productId && l.name) {
        productId = await createCustomProductFromLine(l, trx)
      }

      const item = new QuotationItem()
      item.quotationId = quotation.id
      item.productId = productId
      item.description = l.name
      item.qty = l.qty
      item.unitPrice = String(l.unitPrice)
      item.profitPctUsed = l.profitPctUsed !== null ? String(l.profitPctUsed) : null
      item.taxRatePct = String(l.taxRatePct)
      item.lineSubtotal = String(l.lineSubtotal)
      item.lineTax = String(l.lineTax)
      item.lineTotal = String(l.lineTotal)
      item.useTransaction(trx)
      await item.save()

      for (const bom of l.bomSnapshots) {
        const b = new QuotationItemBom()
        b.quotationItemId = item.id
        b.itemKind = bom.itemKind
        b.itemId = bom.itemId
        b.qty = String(bom.qty)
        b.unitCostAtTime = String(bom.unitCost)
        b.useTransaction(trx)
        await b.save()
      }
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
    await invalidatePdf(q)
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
