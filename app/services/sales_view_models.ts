import Sale from '#models/sale'
import SaleItem from '#models/sale_item'
import Invoice from '#models/invoice'
import InvoiceItem from '#models/invoice_item'
import InvoicePayment from '#models/invoice_payment'
import Customer from '#models/customer'
import Product from '#models/product'

export async function getSalesIndexViewModel(
  filters: { q?: string; status?: string; customerId?: number } = {}
) {
  const query = Sale.query().orderBy('created_at', 'desc').limit(500)
  if (filters.status && filters.status !== 'all') query.where('status', filters.status)
  if (filters.customerId) query.where('customer_id', filters.customerId)
  if (filters.q) query.whereILike('number', `%${filters.q.trim()}%`)
  const [sales, customers, products] = await Promise.all([
    query,
    Customer.query().where('is_active', true).orderBy('name', 'asc'),
    Product.query().where('is_active', true).orderBy('name', 'asc'),
  ])
  const cById = new Map(customers.map((c) => [c.id, c]))

  return {
    sales: sales.map((s) => ({
      id: s.id,
      number: s.number,
      customerId: s.customerId,
      customerName: cById.get(s.customerId)?.name ?? '—',
      status: s.status,
      total: s.total,
      confirmedAt: s.confirmedAt?.toISO() ?? null,
      quotationId: s.quotationId,
    })),
    customers: customers.map((c) => ({ id: c.id, name: c.name })),
    products: products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      taxRatePct: p.taxRatePct,
    })),
  }
}

export async function getSaleShowViewModel(id: number) {
  const sale = await Sale.findOrFail(id)
  const [items, customer, invoice] = await Promise.all([
    SaleItem.query().where('sale_id', id).orderBy('id', 'asc'),
    Customer.find(sale.customerId),
    Invoice.findBy('sale_id', id),
  ])
  return {
    sale: {
      id: sale.id,
      number: sale.number,
      status: sale.status,
      customer: customer ? { id: customer.id, name: customer.name } : null,
      subtotal: sale.subtotal,
      taxTotal: sale.taxTotal,
      total: sale.total,
      note: sale.note,
      confirmedAt: sale.confirmedAt?.toISO() ?? null,
      quotationId: sale.quotationId,
    },
    items: items.map((it) => ({
      id: it.id,
      productId: it.productId,
      description: it.description,
      qty: it.qty,
      unitPrice: it.unitPrice,
      taxRatePct: it.taxRatePct,
      lineSubtotal: it.lineSubtotal,
      lineTax: it.lineTax,
      lineTotal: it.lineTotal,
    })),
    invoice: invoice
      ? {
          id: invoice.id,
          number: invoice.number,
          status: invoice.status,
          total: invoice.total,
          paidTotal: invoice.paidTotal,
        }
      : null,
  }
}

export async function getInvoicesIndexViewModel(
  filters: { q?: string; status?: string; customerId?: number } = {}
) {
  const query = Invoice.query().orderBy('issued_at', 'desc').limit(500)
  if (filters.status && filters.status !== 'all') query.where('status', filters.status)
  if (filters.customerId) query.where('customer_id', filters.customerId)
  if (filters.q) query.whereILike('number', `%${filters.q.trim()}%`)
  const [invoices, customers] = await Promise.all([query, Customer.query().orderBy('name', 'asc')])
  const cById = new Map(customers.map((c) => [c.id, c]))
  return {
    invoices: invoices.map((i) => ({
      id: i.id,
      number: i.number,
      saleId: i.saleId,
      customerId: i.customerId,
      customerName: cById.get(i.customerId)?.name ?? '—',
      status: i.status,
      issuedAt: i.issuedAt.toISO(),
      dueAt: i.dueAt.toISO(),
      total: i.total,
      paidTotal: i.paidTotal,
    })),
    customers: customers.map((c) => ({ id: c.id, name: c.name })),
  }
}

export async function getInvoiceShowViewModel(id: number) {
  const invoice = await Invoice.findOrFail(id)
  const [items, payments, customer] = await Promise.all([
    InvoiceItem.query().where('invoice_id', id).orderBy('id', 'asc'),
    InvoicePayment.query().where('invoice_id', id).orderBy('paid_at', 'asc'),
    Customer.find(invoice.customerId),
  ])
  return {
    invoice: {
      id: invoice.id,
      number: invoice.number,
      saleId: invoice.saleId,
      status: invoice.status,
      issuedAt: invoice.issuedAt.toISO(),
      dueAt: invoice.dueAt.toISO(),
      subtotal: invoice.subtotal,
      taxTotal: invoice.taxTotal,
      total: invoice.total,
      paidTotal: invoice.paidTotal,
      customer: customer
        ? {
            id: customer.id,
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            address: customer.billingAddress,
          }
        : null,
      replacesInvoiceId: invoice.replacesInvoiceId,
    },
    items: items.map((it) => ({
      id: it.id,
      productId: it.productId,
      description: it.description,
      qty: it.qty,
      unitPrice: it.unitPrice,
      taxRatePct: it.taxRatePct,
      lineSubtotal: it.lineSubtotal,
      lineTax: it.lineTax,
      lineTotal: it.lineTotal,
    })),
    payments: payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      method: p.method,
      paidAt: p.paidAt.toISO(),
      reference: p.reference,
    })),
  }
}
