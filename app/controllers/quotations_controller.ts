import type { HttpContext } from '@adonisjs/core/http'
import React from 'react'
import { createQuotationValidator, suggestPriceValidator } from '#validators/quotations'
import {
  getQuotationShowViewModel,
  getQuotationsIndexViewModel,
} from '#services/quotations_view_models'
import {
  acceptQuotation,
  createQuotation,
  rejectQuotation,
  sendQuotation,
} from '#services/quotation_service'
import { suggestPriceFor } from '#services/pricing'
import { convertQuotationToSale } from '#services/sale_service'
import { DomainError } from '#services/domain_errors'
import Quotation from '#models/quotation'
import env from '#start/env'
import { ensurePdf, streamPdf } from '#services/document_pdf/render'
import { QuotationDocument } from '#services/document_pdf/quotation_document'

export default class QuotationsController {
  async index({ request, inertia, bouncer }: HttpContext) {
    await bouncer.authorize('quotations.view' as never)
    const qs = request.qs()
    const data = await getQuotationsIndexViewModel({
      q: typeof qs.q === 'string' ? qs.q : undefined,
      status: typeof qs.status === 'string' ? qs.status : undefined,
      customerId: qs.customerId ? Number(qs.customerId) : undefined,
    })
    return inertia.render('quotations/index', {
      ...data,
      filters: {
        q: typeof qs.q === 'string' ? qs.q : '',
        status: typeof qs.status === 'string' ? qs.status : 'all',
        customerId: qs.customerId ? String(qs.customerId) : 'all',
      },
    })
  }

  async show({ params, inertia, bouncer }: HttpContext) {
    await bouncer.authorize('quotations.view' as never)
    const data = await getQuotationShowViewModel(Number(params.id))
    return inertia.render('quotations/show', data)
  }

  async store({ request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('quotations.create' as never)
    const payload = await request.validateUsing(createQuotationValidator)
    try {
      const q = await createQuotation({
        customerId: payload.customerId,
        validUntil: payload.validUntil,
        note: payload.note ?? null,
        items: payload.items.map((i) => ({
          productId: i.productId ?? null,
          name: i.name,
          qty: i.qty,
          unitPrice: i.unitPrice ?? null,
          profitPctOverride: i.profitPctOverride ?? null,
          taxRatePct: i.taxRatePct ?? null,
          boms: i.boms ?? [],
        })),
        actor: auth.user!,
      })
      session.flash('success', `Quotation ${q.number} created.`)
      return response.redirect().toPath(`/quotations/${q.id}`)
    } catch (err) {
      if (err instanceof DomainError) {
        session.flash('error', err.message)
        return response.redirect().back()
      }
      throw err
    }
  }

  async send({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('quotations.send' as never)
    try {
      await sendQuotation(Number(params.id), auth.user!)
      session.flash('success', 'Quotation sent.')
    } catch (err) {
      return this._domain(err, response, session)
    }
    return response.redirect().back()
  }

  async accept({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('quotations.accept' as never)
    try {
      await acceptQuotation(Number(params.id), auth.user!)
      session.flash('success', 'Quotation accepted.')
    } catch (err) {
      return this._domain(err, response, session)
    }
    return response.redirect().back()
  }

  async reject({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('quotations.reject' as never)
    try {
      await rejectQuotation(Number(params.id), auth.user!)
      session.flash('success', 'Quotation rejected.')
    } catch (err) {
      return this._domain(err, response, session)
    }
    return response.redirect().back()
  }

  async convert({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('quotations.convertToSale' as never)
    try {
      const sale = await convertQuotationToSale(Number(params.id), auth.user!)
      session.flash('success', `Sale ${sale.number} created from quotation.`)
      return response.redirect().toPath(`/sales/${sale.id}`)
    } catch (err) {
      return this._domain(err, response, session)
    }
  }

  async download({ params, response, bouncer }: HttpContext) {
    await bouncer.authorize('quotations.view' as never)
    const quotation = await Quotation.findOrFail(params.id)
    const vm = await getQuotationShowViewModel(quotation.id)
    const appName = env.get('APP_NAME')
    await ensurePdf('quotation', quotation, () =>
      React.createElement(QuotationDocument, { ...vm, appName })
    )
    await streamPdf(quotation.pdfKey!, response, `quotation-${quotation.number}.pdf`)
  }

  async suggestPrice({ request, bouncer, response }: HttpContext) {
    await bouncer.authorize('quotations.create' as never)
    const payload = await request.validateUsing(suggestPriceValidator)
    const breakdown = await suggestPriceFor(payload.productId)
    return response.json({ data: breakdown })
  }

  private _domain(
    err: unknown,
    response: HttpContext['response'],
    session: HttpContext['session']
  ) {
    if (err instanceof DomainError) {
      session.flash('error', err.message)
      return response.redirect().back()
    }
    throw err
  }
}
