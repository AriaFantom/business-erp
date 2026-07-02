import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import {
  createPurchaseValidator,
  payPurchaseValidator,
  returnPurchaseValidator,
} from '#validators/purchases'
import {
  getPurchasesIndexViewModel,
  getPurchaseShowViewModel,
} from '#services/purchases_view_models'
import {
  cancelPurchase,
  confirmPurchase,
  createPurchase,
  recordPurchasePayment,
  returnPurchaseItems,
} from '#services/purchase_service'
import { DomainError } from '#services/domain_errors'

export default class PurchasesController {
  async index({ request, inertia, bouncer }: HttpContext) {
    await bouncer.authorize('purchases.view' as never)
    const qs = request.qs()
    const data = await getPurchasesIndexViewModel({
      q: typeof qs.q === 'string' ? qs.q : undefined,
      status: typeof qs.status === 'string' ? qs.status : undefined,
      supplierId: qs.supplierId ? Number(qs.supplierId) : undefined,
    })
    return inertia.render('purchases/index', {
      ...data,
      filters: {
        q: typeof qs.q === 'string' ? qs.q : '',
        status: typeof qs.status === 'string' ? qs.status : 'all',
        supplierId: qs.supplierId ? String(qs.supplierId) : 'all',
      },
    })
  }

  async show({ params, inertia, bouncer }: HttpContext) {
    await bouncer.authorize('purchases.view' as never)
    const data = await getPurchaseShowViewModel(Number(params.id))
    return inertia.render('purchases/show', data)
  }

  async store({ request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('purchases.create' as never)
    const payload = await request.validateUsing(createPurchaseValidator)

    try {
      const purchase = await createPurchase({
        supplierId: payload.supplierId,
        purchasedAt: payload.purchasedAt ?? DateTime.now(),
        note: payload.note ?? null,
        items: payload.items,
        actor: auth.user!,
      })
      session.flash('success', `Purchase ${purchase.number} created as draft.`)
      return response.redirect().toPath(`/purchases/${purchase.id}`)
    } catch (err) {
      if (err instanceof DomainError) {
        session.flash('error', err.message)
        return response.redirect().back()
      }
      throw err
    }
  }

  async confirm({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('purchases.confirm' as never)
    try {
      const p = await confirmPurchase(Number(params.id), auth.user!)
      session.flash('success', `Purchase ${p.number} confirmed; stock updated.`)
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
    await bouncer.authorize('purchases.return' as never)
    const payload = await request.validateUsing(returnPurchaseValidator)
    try {
      const ret = await returnPurchaseItems({
        purchaseId: Number(params.id),
        items: payload.items,
        note: payload.note ?? null,
        actor: auth.user!,
      })
      session.flash('success', `Return ${ret.number} recorded; stock updated.`)
    } catch (err) {
      if (err instanceof DomainError) {
        session.flash('error', err.message)
        return response.redirect().back()
      }
      throw err
    }
    return response.redirect().back()
  }

  async storePayment({ params, request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('purchases.pay' as never)
    const payload = await request.validateUsing(payPurchaseValidator)
    try {
      await recordPurchasePayment({
        purchaseId: Number(params.id),
        amount: payload.amount,
        method: payload.method,
        reference: payload.reference ?? null,
        note: payload.note ?? null,
        actor: auth.user!,
      })
      session.flash('success', `Payment of ${payload.amount.toFixed(2)} recorded.`)
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
    await bouncer.authorize('purchases.cancel' as never)
    try {
      const p = await cancelPurchase(Number(params.id), auth.user!)
      session.flash('success', `Purchase ${p.number} cancelled.`)
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
