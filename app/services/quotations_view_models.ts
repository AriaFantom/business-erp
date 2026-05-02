import Quotation from '#models/quotation'
import QuotationItem from '#models/quotation_item'
import Customer from '#models/customer'
import Product from '#models/product'

export async function getQuotationsIndexViewModel() {
  const [quotations, customers, products] = await Promise.all([
    Quotation.query().orderBy('created_at', 'desc').limit(200),
    Customer.query().where('is_active', true).orderBy('name', 'asc'),
    Product.query().where('is_active', true).orderBy('name', 'asc'),
  ])
  const customerById = new Map(customers.map((c) => [c.id, c]))

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
    products: products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      defaultProfitPct: p.defaultProfitPct,
      taxRatePct: p.taxRatePct,
    })),
  }
}

export async function getQuotationShowViewModel(id: number) {
  const q = await Quotation.findOrFail(id)
  const [items, customer] = await Promise.all([
    QuotationItem.query().where('quotation_id', id).orderBy('id', 'asc'),
    Customer.find(q.customerId),
  ])
  const productIds = items
    .map((i) => i.productId)
    .filter((x): x is number => typeof x === 'number')
  const products = productIds.length
    ? await Product.query().whereIn('id', productIds)
    : []
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
      productName: it.productId ? productById.get(it.productId)?.name ?? '—' : null,
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
