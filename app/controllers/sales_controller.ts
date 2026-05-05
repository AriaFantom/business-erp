import type { HttpContext } from '@adonisjs/core/http'
import { createSaleValidator } from '#validators/sales'
import { getSaleShowViewModel, getSalesIndexViewModel } from '#services/sales_view_models'
import { cancelSale, confirmSale, createSale } from '#services/sale_service'
import { DomainError } from '#services/domain_errors'

export default class SalesController {
  async index({ inertia, bouncer }: HttpContext) {
    await bouncer.authorize('sales.view' as never)
    const data = await getSalesIndexViewModel()
    return inertia.render('sales/index', data)
  }

  async show({ params, inertia, bouncer }: HttpContext) {
    await bouncer.authorize('sales.view' as never)
    const data = await getSaleShowViewModel(Number(params.id))
    return inertia.render('sales/show', data)
  }

  async store({ request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('sales.create' as never)
    const payload = await request.validateUsing(createSaleValidator)
    try {
      const sale = await createSale({
        customerId: payload.customerId,
        quotationId: payload.quotationId ?? null,
        note: payload.note ?? null,
        items: payload.items.map((i) => ({
          productId: i.productId ?? null,
          description: i.description,
          qty: i.qty,
          unitPrice: i.unitPrice,
          taxRatePct: i.taxRatePct,
        })),
        actor: auth.user!,
      })
      session.flash('success', `Sale ${sale.number} created.`)
      return response.redirect().toPath(`/sales/${sale.id}`)
    } catch (err) {
      if (err instanceof DomainError) {
        session.flash('error', err.message)
        return response.redirect().back()
      }
      throw err
    }
  }

  async confirm({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('sales.confirm' as never)
    try {
      const sale = await confirmSale(Number(params.id), auth.user!)
      session.flash('success', `Sale ${sale.number} confirmed; invoice issued.`)
    } catch (err) {
      if (err instanceof DomainError) {
        session.flash('error', err.message)
        return response.redirect().back()
      }
      throw err
    }
    return response.redirect().back()
  }

  async cancel({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('sales.cancel' as never)
    try {
      await cancelSale(Number(params.id), auth.user!)
      session.flash('success', 'Sale cancelled.')
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
