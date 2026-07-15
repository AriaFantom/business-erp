import { DateTime } from 'luxon'
import Order from '#models/order'
import OrderItem from '#models/order_item'
import OrderReturn from '#models/order_return'
import OrderReturnItem from '#models/order_return_item'
import Invoice from '#models/invoice'
import InvoiceItem from '#models/invoice_item'
import InvoicePayment from '#models/invoice_payment'
import Customer from '#models/customer'
import Product from '#models/product'
import ProductCategory from '#models/product_category'
import { computeUnitPrice } from '#services/pricing'
import { latestProductCost } from '#services/job_costing'

export async function getOrdersIndexViewModel(
  filters: { q?: string; status?: string; customerId?: number } = {}
) {
  const query = Order.query().orderBy('created_at', 'desc').limit(500)
  if (filters.status && filters.status !== 'all') query.where('status', filters.status)
  if (filters.customerId) query.where('customer_id', filters.customerId)
  if (filters.q) query.whereILike('number', `%${filters.q.trim()}%`)
  const [orders, customers] = await Promise.all([
    query,
    Customer.query().where('is_active', true).orderBy('name', 'asc'),
  ])
  const cById = new Map(customers.map((c) => [c.id, c]))

  return {
    orders: orders.map((o) => ({
      id: o.id,
      number: o.number,
      customerId: o.customerId,
      customerName: cById.get(o.customerId)?.name ?? '—',
      status: o.status,
      total: o.total,
      confirmedAt: o.confirmedAt?.toISO() ?? null,
      quotationId: o.quotationId,
    })),
    customers: customers.map((c) => ({ id: c.id, name: c.name })),
  }
}

export async function getOrderCreateViewModel() {
  const [customers, products] = await Promise.all([
    Customer.query().where('is_active', true).orderBy('name', 'asc'),
    Product.query().where('is_active', true).orderBy('name', 'asc'),
  ])

  // Suggested pricing per product, from the same source as the server-side
  // enforcement (resolveOrderLinePricing), so the new-order page prefills a
  // price the server will accept without treating it as an override. Tax is
  // likewise server-derived per product.
  const categoryIds = [
    ...new Set(products.map((p) => p.categoryId).filter((id): id is number => !!id)),
  ]
  const cats = categoryIds.length ? await ProductCategory.query().whereIn('id', categoryIds) : []
  const catById = new Map(cats.map((c) => [c.id, c]))
  const breakdowns = await Promise.all(
    products.map(async (p) => {
      const cost = await latestProductCost(p.id)
      return computeUnitPrice({
        costPrice: cost,
        product: p,
        category: p.categoryId ? (catById.get(p.categoryId) ?? null) : null,
      })
    })
  )

  return {
    customers: customers.map((c) => ({ id: c.id, name: c.name })),
    products: products.map((p, idx) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      taxRatePct: breakdowns[idx].taxRatePct,
      suggestedUnitPrice: breakdowns[idx].unitPrice,
    })),
  }
}

export async function getOrderShowViewModel(id: number) {
  const order = await Order.findOrFail(id)
  const [items, customer, invoice, returns] = await Promise.all([
    OrderItem.query().where('order_id', id).orderBy('id', 'asc'),
    Customer.find(order.customerId),
    Invoice.findBy('order_id', id),
    OrderReturn.query().where('order_id', id).orderBy('id', 'desc'),
  ])

  // Already-returned qty per order line, across all credit notes.
  const returnItems = returns.length
    ? await OrderReturnItem.query().whereIn(
        'order_return_id',
        returns.map((r) => r.id)
      )
    : []
  const returnedByItem = new Map<number, number>()
  for (const ri of returnItems) {
    returnedByItem.set(ri.orderItemId, (returnedByItem.get(ri.orderItemId) ?? 0) + Number(ri.qty))
  }

  return {
    order: {
      id: order.id,
      number: order.number,
      status: order.status,
      customer: customer ? { id: customer.id, name: customer.name } : null,
      subtotal: order.subtotal,
      taxTotal: order.taxTotal,
      total: order.total,
      note: order.note,
      confirmedAt: order.confirmedAt?.toISO() ?? null,
      quotationId: order.quotationId,
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
      returnedQty: returnedByItem.get(it.id) ?? 0,
    })),
    invoice: invoice
      ? {
          id: invoice.id,
          number: invoice.number,
          status: invoice.status,
          total: invoice.total,
          paidTotal: invoice.paidTotal,
          creditTotal: invoice.creditTotal,
        }
      : null,
    returns: returns.map((r) => ({
      id: r.id,
      number: r.number,
      createdAt: r.createdAt?.toISO() ?? null,
      total: r.total,
      creditApplied: r.creditApplied,
      refundAmount: r.refundAmount,
      refundMethod: r.refundMethod,
      note: r.note,
    })),
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

  const round2 = (n: number) => Math.round(n * 100) / 100
  const now = DateTime.now()
  const overdueDaysOf = (inv: Invoice, balance: number) => {
    if (balance <= 0.005 || inv.status === 'void') return 0
    const days = Math.floor(now.diff(inv.dueAt, 'days').days)
    return days > 0 ? days : 0
  }

  // Receivables aging over ALL open invoices (not just the filtered page):
  // balances bucketed by days past due.
  const openInvoices = await Invoice.query()
    .whereNot('status', 'void')
    .whereRaw('total - paid_total - credit_total > 0.005')
  const aging = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 }
  for (const inv of openInvoices) {
    const balance = round2(Number(inv.total) - Number(inv.paidTotal) - Number(inv.creditTotal))
    const days = overdueDaysOf(inv, balance)
    if (days <= 0) aging.current += balance
    else if (days <= 30) aging.d1_30 += balance
    else if (days <= 60) aging.d31_60 += balance
    else if (days <= 90) aging.d61_90 += balance
    else aging.d90plus += balance
  }

  return {
    invoices: invoices.map((i) => {
      const balance = round2(Number(i.total) - Number(i.paidTotal) - Number(i.creditTotal))
      return {
        id: i.id,
        number: i.number,
        orderId: i.orderId,
        customerId: i.customerId,
        customerName: cById.get(i.customerId)?.name ?? '—',
        status: i.status,
        issuedAt: i.issuedAt.toISO(),
        dueAt: i.dueAt.toISO(),
        total: i.total,
        paidTotal: i.paidTotal,
        balance: String(Math.max(0, balance)),
        overdueDays: overdueDaysOf(i, balance),
      }
    }),
    customers: customers.map((c) => ({ id: c.id, name: c.name })),
    aging: {
      current: round2(aging.current),
      d1_30: round2(aging.d1_30),
      d31_60: round2(aging.d31_60),
      d61_90: round2(aging.d61_90),
      d90plus: round2(aging.d90plus),
    },
  }
}

export async function getInvoiceShowViewModel(id: number) {
  const invoice = await Invoice.findOrFail(id)
  const [items, payments, customer, creditNotes] = await Promise.all([
    InvoiceItem.query().where('invoice_id', id).orderBy('id', 'asc'),
    InvoicePayment.query().where('invoice_id', id).orderBy('paid_at', 'asc'),
    Customer.find(invoice.customerId),
    OrderReturn.query().where('invoice_id', id).orderBy('id', 'asc'),
  ])
  return {
    invoice: {
      id: invoice.id,
      number: invoice.number,
      orderId: invoice.orderId,
      status: invoice.status,
      issuedAt: invoice.issuedAt.toISO(),
      dueAt: invoice.dueAt.toISO(),
      subtotal: invoice.subtotal,
      taxTotal: invoice.taxTotal,
      total: invoice.total,
      paidTotal: invoice.paidTotal,
      creditTotal: invoice.creditTotal,
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
    creditNotes: creditNotes.map((cn) => ({
      id: cn.id,
      orderId: cn.orderId,
      number: cn.number,
      createdAt: cn.createdAt?.toISO() ?? null,
      total: cn.total,
      creditApplied: cn.creditApplied,
      refundAmount: cn.refundAmount,
      refundMethod: cn.refundMethod,
    })),
  }
}
