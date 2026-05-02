import type { HttpContext } from '@adonisjs/core/http'
import Component from '#models/component'
import {
  createComponentValidator,
  updateComponentValidator,
} from '#validators/catalog'
import { getComponentsViewModel } from '#services/catalog_view_models'
import { audit } from '#services/audit'

export default class ComponentsController {
  async index({ inertia, bouncer }: HttpContext) {
    await bouncer.authorize('components.view' as never)
    const data = await getComponentsViewModel()
    return inertia.render('catalog/components', data)
  }

  async store({ request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('components.create' as never)
    const payload = await request.validateUsing(createComponentValidator)

    const dup = await Component.findBy('sku', payload.sku)
    if (dup) {
      session.flash('errors', { sku: 'A component with this SKU already exists.' })
      return response.redirect().back()
    }

    const component = await Component.create({
      sku: payload.sku,
      name: payload.name,
      unit: 'pcs',
      defaultSupplierId: payload.defaultSupplierId ?? null,
      defaultUnitCost: String(payload.defaultUnitCost),
      reorderThresholdQty: payload.reorderThresholdQty ?? null,
      isActive: true,
    })
    await audit({
      actor: auth.user!,
      action: 'component.create',
      targetType: 'component',
      targetId: component.id,
      payload,
    })
    session.flash('success', `Component "${component.name}" created.`)
    return response.redirect().back()
  }

  async update({ params, request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('components.update' as never)
    const component = await Component.findOrFail(params.id)
    const payload = await request.validateUsing(updateComponentValidator)

    component.merge({
      ...payload,
      defaultUnitCost:
        payload.defaultUnitCost !== undefined
          ? String(payload.defaultUnitCost)
          : component.defaultUnitCost,
    })
    await component.save()
    await audit({
      actor: auth.user!,
      action: 'component.update',
      targetType: 'component',
      targetId: component.id,
      payload,
    })
    session.flash('success', 'Component updated.')
    return response.redirect().back()
  }

  async archive({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('components.archive' as never)
    const component = await Component.findOrFail(params.id)
    component.isActive = false
    await component.save()
    await audit({
      actor: auth.user!,
      action: 'component.archive',
      targetType: 'component',
      targetId: component.id,
    })
    session.flash('success', 'Component archived.')
    return response.redirect().back()
  }
}
