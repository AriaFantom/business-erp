import type { HttpContext } from '@adonisjs/core/http'
import { recordPaymentValidator } from '#validators/sales'
import { getInvoiceShowViewModel, getInvoicesIndexViewModel } from '#services/sales_view_models'
import { recordPayment, voidInvoice } from '#services/invoice_service'
import { DomainError } from '#services/domain_errors'

export default class InvoicesController {
  async index({ inertia, bouncer }: HttpContext) {
    await bouncer.authorize('invoices.view' as never)
    const data = await getInvoicesIndexViewModel()
    return inertia.render('invoices/index', data)
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
}
