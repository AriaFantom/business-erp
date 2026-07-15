import type { HttpContext } from '@adonisjs/core/http'
import { createOrderValidator, returnOrderValidator } from '#validators/orders'
import {
  getOrderCreateViewModel,
  getOrderShowViewModel,
  getOrdersIndexViewModel,
} from '#services/orders_view_models'
import { cancelOrder, confirmOrder, createOrder } from '#services/order_service'
import { createOrderReturn } from '#services/order_return_service'
import { DomainError } from '#services/domain_errors'

export default class OrdersController {
  async index({ request, inertia, bouncer }: HttpContext) {
    await bouncer.authorize('orders.view' as never)
    const qs = request.qs()
    const data = await getOrdersIndexViewModel({
      q: typeof qs.q === 'string' ? qs.q : undefined,
      status: typeof qs.status === 'string' ? qs.status : undefined,
      customerId: qs.customerId ? Number(qs.customerId) : undefined,
    })
    return inertia.render('orders/index', {
      ...data,
      filters: {
        q: typeof qs.q === 'string' ? qs.q : '',
        status: typeof qs.status === 'string' ? qs.status : 'all',
        customerId: qs.customerId ? String(qs.customerId) : 'all',
      },
    })
  }

  async create({ inertia, bouncer }: HttpContext) {
    await bouncer.authorize('orders.create' as never)
    return inertia.render('orders/new', await getOrderCreateViewModel())
  }

  async show({ params, inertia, bouncer }: HttpContext) {
    await bouncer.authorize('orders.view' as never)
    const data = await getOrderShowViewModel(Number(params.id))
    return inertia.render('orders/show', data)
  }

  async store({ request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('orders.create' as never)
    const payload = await request.validateUsing(createOrderValidator)
    try {
      const order = await createOrder({
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
        allowPriceOverride: await bouncer.allows('orders.overridePrice' as never),
        actor: auth.user!,
      })
      session.flash('success', `Order ${order.number} created.`)
      return response.redirect().toPath(`/orders/${order.id}`)
    } catch (err) {
      if (err instanceof DomainError) {
        session.flash('error', err.message)
        return response.redirect().back()
      }
      throw err
    }
  }

  async confirm({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('orders.confirm' as never)
    try {
      const order = await confirmOrder(Number(params.id), auth.user!)
      session.flash('success', `Order ${order.number} confirmed; invoice issued.`)
    } catch (err) {
      if (err instanceof DomainError) {
        session.flash('error', err.message)
        return response.redirect().back()
      }
      throw err
    }
    return response.redirect().back()
  }

  async storeReturn({ params, request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('orders.return' as never)
    const payload = await request.validateUsing(returnOrderValidator)
    try {
      const ret = await createOrderReturn({
        orderId: Number(params.id),
        items: payload.items,
        refundMethod: payload.refundMethod ?? null,
        note: payload.note ?? null,
        actor: auth.user!,
      })
      const refund = Number(ret.refundAmount)
      session.flash(
        'success',
        refund > 0
          ? `Credit note ${ret.number} issued; refund ${ret.refundAmount} via ${ret.refundMethod}.`
          : `Credit note ${ret.number} issued; ${ret.creditApplied} applied to the invoice.`
      )
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
    await bouncer.authorize('orders.cancel' as never)
    try {
      await cancelOrder(Number(params.id), auth.user!)
      session.flash('success', 'Order cancelled.')
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
