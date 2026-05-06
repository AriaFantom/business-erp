import type { HttpContext } from '@adonisjs/core/http'
import Customer from '#models/customer'
import Invoice from '#models/invoice'
import { createCustomerValidator, updateCustomerValidator } from '#validators/catalog'
import { getCustomersViewModel } from '#services/catalog_view_models'
import { audit } from '#services/audit'

export default class CustomersController {
  async index({ request, inertia, bouncer }: HttpContext) {
    await bouncer.authorize('customers.view' as never)
    const qs = request.qs()
    const data = await getCustomersViewModel({
      q: typeof qs.q === 'string' ? qs.q : undefined,
      status: typeof qs.status === 'string' ? qs.status : undefined,
    })
    return inertia.render('customers/index', {
      ...data,
      filters: {
        q: typeof qs.q === 'string' ? qs.q : '',
        status: typeof qs.status === 'string' ? qs.status : 'all',
      },
    })
  }

  async store({ request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('customers.create' as never)
    const payload = await request.validateUsing(createCustomerValidator)
    const customer = await Customer.create({ ...payload, isActive: true })
    await audit({
      actor: auth.user!,
      action: 'customer.create',
      targetType: 'customer',
      targetId: customer.id,
      payload,
    })
    session.flash('success', `Customer "${customer.name}" created.`)
    return response.redirect().back()
  }

  async update({ params, request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('customers.update' as never)
    const customer = await Customer.findOrFail(params.id)
    const payload = await request.validateUsing(updateCustomerValidator)
    customer.merge(payload)
    await customer.save()
    await audit({
      actor: auth.user!,
      action: 'customer.update',
      targetType: 'customer',
      targetId: customer.id,
      payload,
    })
    session.flash('success', 'Customer updated.')
    return response.redirect().back()
  }

  async archive({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('customers.archive' as never)
    const customer = await Customer.findOrFail(params.id)

    // Refuse archive if any unpaid/partial invoices exist — financial drift.
    const openInvoice = await Invoice.query()
      .where('customer_id', customer.id)
      .whereIn('status', ['unpaid', 'partial'])
      .first()
    if (openInvoice) {
      session.flash(
        'error',
        'Cannot archive customer with open invoices. Settle or void them first.'
      )
      return response.redirect().back()
    }

    customer.isActive = false
    await customer.save()
    await audit({
      actor: auth.user!,
      action: 'customer.archive',
      targetType: 'customer',
      targetId: customer.id,
    })
    session.flash('success', 'Customer archived.')
    return response.redirect().back()
  }
}
