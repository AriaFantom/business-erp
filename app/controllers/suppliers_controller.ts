import type { HttpContext } from '@adonisjs/core/http'
import Supplier from '#models/supplier'
import {
  createSupplierValidator,
  updateSupplierValidator,
} from '#validators/catalog'
import { getSuppliersViewModel } from '#services/catalog_view_models'
import { audit } from '#services/audit'

export default class SuppliersController {
  async index({ inertia, bouncer }: HttpContext) {
    await bouncer.authorize('suppliers.view' as never)
    const data = await getSuppliersViewModel()
    return inertia.render('suppliers/index', data)
  }

  async store({ request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('suppliers.create' as never)
    const payload = await request.validateUsing(createSupplierValidator)
    const supplier = await Supplier.create({ ...payload, isActive: true })
    await audit({
      actor: auth.user!,
      action: 'supplier.create',
      targetType: 'supplier',
      targetId: supplier.id,
      payload,
    })
    session.flash('success', `Supplier "${supplier.name}" created.`)
    return response.redirect().back()
  }

  async update({ params, request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('suppliers.update' as never)
    const supplier = await Supplier.findOrFail(params.id)
    const payload = await request.validateUsing(updateSupplierValidator)
    supplier.merge(payload)
    await supplier.save()
    await audit({
      actor: auth.user!,
      action: 'supplier.update',
      targetType: 'supplier',
      targetId: supplier.id,
      payload,
    })
    session.flash('success', 'Supplier updated.')
    return response.redirect().back()
  }

  async archive({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('suppliers.archive' as never)
    const supplier = await Supplier.findOrFail(params.id)
    supplier.isActive = false
    await supplier.save()
    await audit({
      actor: auth.user!,
      action: 'supplier.archive',
      targetType: 'supplier',
      targetId: supplier.id,
    })
    session.flash('success', 'Supplier archived.')
    return response.redirect().back()
  }
}
