import type { HttpContext } from '@adonisjs/core/http'
import React from 'react'
import { recordPaymentValidator } from '#validators/sales'
import { getInvoiceShowViewModel, getInvoicesIndexViewModel } from '#services/sales_view_models'
import { recordPayment, voidInvoice } from '#services/invoice_service'
import { DomainError } from '#services/domain_errors'
import Invoice from '#models/invoice'
import env from '#start/env'
import { ensurePdf, streamPdf } from '#services/document_pdf/render'
import { InvoiceDocument } from '#services/document_pdf/invoice_document'

export default class InvoicesController {
  async index({ request, inertia, bouncer }: HttpContext) {
    await bouncer.authorize('invoices.view' as never)
    const qs = request.qs()
    const data = await getInvoicesIndexViewModel({
      q: typeof qs.q === 'string' ? qs.q : undefined,
      status: typeof qs.status === 'string' ? qs.status : undefined,
      customerId: qs.customerId ? Number(qs.customerId) : undefined,
    })
    return inertia.render('invoices/index', {
      ...data,
      filters: {
        q: typeof qs.q === 'string' ? qs.q : '',
        status: typeof qs.status === 'string' ? qs.status : 'all',
        customerId: qs.customerId ? String(qs.customerId) : 'all',
      },
    })
  }

  async show({ params, inertia, bouncer }: HttpContext) {
    await bouncer.authorize('invoices.view' as never)
    const data = await getInvoiceShowViewModel(Number(params.id))
    return inertia.render('invoices/show', data)
  }

  async pay({ params, request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('invoices.recordPayment' as never)
    const payload = await request.validateUsing(recordPaymentValidator)
    try {
      await recordPayment({
        invoiceId: Number(params.id),
        amount: payload.amount,
        method: payload.method,
        paidAt: payload.paidAt ?? undefined,
        reference: payload.reference ?? null,
        actor: auth.user!,
      })
      session.flash('success', 'Payment recorded.')
    } catch (err) {
      if (err instanceof DomainError) {
        session.flash('error', err.message)
        return response.redirect().back()
      }
      throw err
    }
    return response.redirect().back()
  }

  async void({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('invoices.void' as never)
    try {
      await voidInvoice(Number(params.id), auth.user!)
      session.flash('success', 'Invoice voided.')
    } catch (err) {
      if (err instanceof DomainError) {
        session.flash('error', err.message)
        return response.redirect().back()
      }
      throw err
    }
    return response.redirect().back()
  }

  async download({ params, response, bouncer }: HttpContext) {
    await bouncer.authorize('invoices.view' as never)
    const invoice = await Invoice.findOrFail(params.id)
    const vm = await getInvoiceShowViewModel(invoice.id)
    const appName = env.get('APP_NAME')
    await ensurePdf('invoice', invoice, () =>
      React.createElement(InvoiceDocument, { ...vm, appName })
    )
    await streamPdf(invoice.pdfKey!, response, `invoice-${invoice.number}.pdf`)
  }
}
