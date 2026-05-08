import type { HttpContext } from '@adonisjs/core/http'
import Component from '#models/component'
import {
  createComponentValidator,
  updateComponentValidator,
  uploadCatalogImageValidator,
} from '#validators/catalog'
import { getComponentsViewModel } from '#services/catalog_view_models'
import { audit } from '#services/audit'
import { storeCatalogImage, removeCatalogImage } from '#services/catalog_image_storage'

export default class ComponentsController {
  async index({ request, inertia, bouncer }: HttpContext) {
    await bouncer.authorize('components.view' as never)
    const qs = request.qs()
    const data = await getComponentsViewModel({
      q: typeof qs.q === 'string' ? qs.q : undefined,
      status: typeof qs.status === 'string' ? qs.status : undefined,
    })
    return inertia.render('catalog/components', {
      ...data,
      filters: {
        q: typeof qs.q === 'string' ? qs.q : '',
        status: typeof qs.status === 'string' ? qs.status : 'all',
      },
    })
  }

  async updateImage({ params, request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('components.update' as never)
    const component = await Component.findOrFail(params.id)
    const payload = await request.validateUsing(uploadCatalogImageValidator)
    await storeCatalogImage('component', component, payload.image)
    await audit({
      actor: auth.user!,
      action: 'component.image.update',
      targetType: 'component',
      targetId: component.id,
    })
    session.flash('success', 'Component image updated.')
    return response.redirect().back()
  }

  async destroyImage({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('components.update' as never)
    const component = await Component.findOrFail(params.id)
    await removeCatalogImage(component)
    await audit({
      actor: auth.user!,
      action: 'component.image.delete',
      targetType: 'component',
      targetId: component.id,
    })
    session.flash('success', 'Component image removed.')
    return response.redirect().back()
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
      unit: payload.unit ?? 'pcs',
      defaultSupplierId: payload.defaultSupplierId ?? null,
      defaultUnitCost: String(payload.defaultUnitCost),
      reorderThresholdQty: payload.reorderThresholdQty ?? null,
      isActive: true,
    })
    if (payload.image) {
      await storeCatalogImage('component', component, payload.image)
    }
    await audit({
      actor: auth.user!,
      action: 'component.create',
      targetType: 'component',
      targetId: component.id,
      payload: { ...payload, image: payload.image ? '<file>' : undefined },
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
      unit: payload.unit ?? component.unit,
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

  async restore({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('components.archive' as never)
    const component = await Component.findOrFail(params.id)
    component.isActive = true
    await component.save()
    await audit({
      actor: auth.user!,
      action: 'component.restore',
      targetType: 'component',
      targetId: component.id,
    })
    session.flash('success', `Component "${component.name}" restored.`)
    return response.redirect().back()
  }
}
