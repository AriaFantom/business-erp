import db from '@adonisjs/lucid/services/db'
import Quotation from '#models/quotation'
import QuotationItem from '#models/quotation_item'
import Customer from '#models/customer'
import Product from '#models/product'
import ProductCategory from '#models/product_category'
import { computeUnitPrice } from '#services/pricing'

export async function getQuotationsIndexViewModel(
  filters: { q?: string; status?: string; customerId?: number } = {}
) {
  const query = Quotation.query().orderBy('created_at', 'desc').limit(500)
  if (filters.status && filters.status !== 'all') query.where('status', filters.status)
  if (filters.customerId) query.where('customer_id', filters.customerId)
  if (filters.q) query.whereILike('number', `%${filters.q.trim()}%`)
  const [quotations, customers, products] = await Promise.all([
    query,
    Customer.query().where('is_active', true).orderBy('name', 'asc'),
    Product.query().where('is_active', true).orderBy('name', 'asc'),
  ])
  const customerById = new Map(customers.map((c) => [c.id, c]))

  const categoryIds = [
    ...new Set(products.map((p) => p.categoryId).filter((id): id is number => !!id)),
  ]
  const cats = categoryIds.length
    ? await ProductCategory.query().whereIn('id', categoryIds)
    : []
  const catById = new Map(cats.map((c) => [c.id, c]))

  const costRows =
    products.length > 0
      ? await db
          .from('production_jobs')
          .whereIn(
            'product_id',
            products.map((p) => p.id)
          )
          .where('status', 'completed')
          .where('produced_qty', '>', 0)
          .groupBy('product_id')
          .select('product_id')
          .sum({ totalCost: 'total_cost' })
          .sum({ totalQty: 'produced_qty' })
      : []
  const costByProduct = new Map<number, number>()
  for (const row of costRows) {
    const total = Number(row.totalCost ?? 0)
    const qty = Number(row.totalQty ?? 0)
    costByProduct.set(Number(row.product_id), qty > 0 ? total / qty : 0)
  }

  return {
    quotations: quotations.map((q) => ({
      id: q.id,
      number: q.number,
      customerId: q.customerId,
      customerName: customerById.get(q.customerId)?.name ?? '—',
      status: q.status,
      issuedAt: q.issuedAt.toISO(),
      validUntil: q.validUntil.toISO(),
      total: q.total,
    })),
    customers: customers.map((c) => ({ id: c.id, name: c.name })),
    products: products.map((p) => {
      const cost = costByProduct.get(p.id) ?? 0
      const breakdown = computeUnitPrice({
        costPrice: cost,
        product: p,
        category: p.categoryId ? catById.get(p.categoryId) ?? null : null,
      })
      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        unitCost: Math.round(cost * 10000) / 10000,
        profitPct: breakdown.profitPctUsed ?? 0,
        taxRatePct: breakdown.taxRatePct,
        suggestedUnitPrice: breakdown.unitPrice,
      }
    }),
  }
}

export async function getQuotationShowViewModel(id: number) {
  const q = await Quotation.findOrFail(id)
  const [items, customer] = await Promise.all([
    QuotationItem.query().where('quotation_id', id).orderBy('id', 'asc'),
    Customer.find(q.customerId),
  ])
  const productIds = items.map((i) => i.productId).filter((x): x is number => typeof x === 'number')
  const products = productIds.length ? await Product.query().whereIn('id', productIds) : []
  const productById = new Map(products.map((p) => [p.id, p]))

  return {
    quotation: {
      id: q.id,
      number: q.number,
      status: q.status,
      customer: customer ? { id: customer.id, name: customer.name } : null,
      issuedAt: q.issuedAt.toISO(),
      validUntil: q.validUntil.toISO(),
      subtotal: q.subtotal,
      taxTotal: q.taxTotal,
      total: q.total,
      note: q.note,
      sentAt: q.sentAt?.toISO() ?? null,
      acceptedAt: q.acceptedAt?.toISO() ?? null,
      rejectedAt: q.rejectedAt?.toISO() ?? null,
      convertedToSaleId: q.convertedToSaleId,
    },
    items: items.map((it) => ({
      id: it.id,
      productId: it.productId,
      productName: it.productId ? (productById.get(it.productId)?.name ?? '—') : null,
      description: it.description,
      qty: it.qty,
      unitPrice: it.unitPrice,
      profitPctUsed: it.profitPctUsed,
      taxRatePct: it.taxRatePct,
      lineSubtotal: it.lineSubtotal,
      lineTax: it.lineTax,
      lineTotal: it.lineTotal,
    })),
  }
}
