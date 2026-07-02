import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'
import Invoice from '#models/invoice'
import InvoiceItem from '#models/invoice_item'
import InvoicePayment from '#models/invoice_payment'
import SaleItem from '#models/sale_item'
import type Sale from '#models/sale'
import type User from '#models/user'
import { audit } from '#services/audit'
import { nextDocNumber } from '#services/numbering'
import { InvalidStateError, OverpaymentError } from '#services/domain_errors'
import { invalidatePdf } from '#services/document_pdf/render'

const DEFAULT_DUE_DAYS = 14

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Issue an invoice for a confirmed sale. One invoice per sale (unique FK).
 * Items are copied at issue time and become immutable.
 *
 * Caller MUST be inside the same transaction as the sale confirmation so
 * that a failed invoice rolls back the confirm.
 */
export async function generateInvoiceForSale(
  sale: Sale,
  actor: User,
  trx: TransactionClientContract,
  opts?: { issuedAt?: DateTime; dueAt?: DateTime; replacesInvoiceId?: number }
): Promise<Invoice> {
  const issuedAt = opts?.issuedAt ?? DateTime.now()
  const dueAt = opts?.dueAt ?? issuedAt.plus({ days: DEFAULT_DUE_DAYS })
  const number = await nextDocNumber('INV', trx, issuedAt)

  const invoice = new Invoice()
  invoice.number = number
  invoice.saleId = sale.id
  invoice.customerId = sale.customerId
  invoice.status = 'unpaid'
  invoice.issuedAt = issuedAt
  invoice.dueAt = dueAt
  invoice.subtotal = sale.subtotal
  invoice.taxTotal = sale.taxTotal
  invoice.total = sale.total
  invoice.paidTotal = '0'
  invoice.replacesInvoiceId = opts?.replacesInvoiceId ?? null
  invoice.createdByUserId = actor.id
  invoice.useTransaction(trx)
  await invoice.save()

  const saleItems = await SaleItem.query({ client: trx }).where('sale_id', sale.id)
  for (const si of saleItems) {
    const it = new InvoiceItem()
    it.invoiceId = invoice.id
    it.productId = si.productId
    it.description = si.description
    it.qty = si.qty
    it.unitPrice = si.unitPrice
    it.taxRatePct = si.taxRatePct
    it.lineSubtotal = si.lineSubtotal
    it.lineTax = si.lineTax
    it.lineTotal = si.lineTotal
    it.useTransaction(trx)
    await it.save()
  }

  await audit({
    actor,
    action: 'invoice.generate',
    targetType: 'invoice',
    targetId: invoice.id,
    payload: { number, saleId: sale.id, total: sale.total },
    trx,
  })
  return invoice
}

export async function recordPayment(input: {
  invoiceId: number
  amount: number
  method: 'cash' | 'bank' | 'upi' | 'other'
  paidAt?: DateTime
  reference?: string | null
  actor: User
}): Promise<InvoicePayment> {
  if (input.amount <= 0) {
    throw new Error('Payment amount must be > 0')
  }
  return db.transaction(async (trx) => {
    const invoice = await Invoice.query({ client: trx })
      .where('id', input.invoiceId)
      .forUpdate()
      .firstOrFail()

    if (invoice.status === 'void') {
      throw new InvalidStateError({
        entity: 'invoice',
        from: 'void',
        to: 'paid (recordPayment)',
      })
    }

    const remaining = round2(
      Number(invoice.total) - Number(invoice.paidTotal) - Number(invoice.creditTotal)
    )
    if (input.amount > remaining + 0.001) {
      throw new OverpaymentError({ remaining, attempted: input.amount })
    }

    const payment = new InvoicePayment()
    payment.invoiceId = invoice.id
    payment.amount = String(input.amount)
    payment.method = input.method
    payment.paidAt = input.paidAt ?? DateTime.now()
    payment.reference = input.reference ?? null
    payment.recordedByUserId = input.actor.id
    payment.useTransaction(trx)
    await payment.save()

    const newPaid = round2(Number(invoice.paidTotal) + input.amount)
    invoice.paidTotal = String(newPaid)
    invoice.status =
      newPaid + Number(invoice.creditTotal) >= Number(invoice.total) - 0.001 ? 'paid' : 'partial'
    await invoice.save()
    await invalidatePdf(invoice)

    await audit({
      actor: input.actor,
      action: 'invoice.recordPayment',
      targetType: 'invoice',
      targetId: invoice.id,
      payload: { amount: input.amount, method: input.method, paidTotal: newPaid },
      trx,
    })
    return payment
  })
}

export async function voidInvoice(invoiceId: number, actor: User): Promise<Invoice> {
  return db.transaction(async (trx) => {
    const invoice = await Invoice.query({ client: trx })
      .where('id', invoiceId)
      .forUpdate()
      .firstOrFail()
    if (invoice.status === 'void') return invoice
    if (Number(invoice.paidTotal) > 0) {
      throw new InvalidStateError({
        entity: 'invoice',
        from: 'has payments',
        to: 'void',
      })
    }
    if (Number(invoice.creditTotal) > 0) {
      throw new InvalidStateError({
        entity: 'invoice',
        from: 'has credit notes',
        to: 'void',
      })
    }
    invoice.status = 'void'
    await invoice.save()
    await invalidatePdf(invoice)

    await audit({
      actor,
      action: 'invoice.void',
      targetType: 'invoice',
      targetId: invoice.id,
      trx,
    })
    return invoice
  })
}
