import type { HttpContext } from '@adonisjs/core/http'
import Material from '#models/material'
import {
  createMaterialValidator,
  updateMaterialValidator,
  uploadCatalogImageValidator,
} from '#validators/catalog'
import { getMaterialsViewModel } from '#services/catalog_view_models'
import { audit } from '#services/audit'
import { storeCatalogImage, removeCatalogImage } from '#services/catalog_image_storage'

export default class MaterialsController {
  async index({ request, inertia, bouncer }: HttpContext) {
    await bouncer.authorize('materials.view' as never)
    const qs = request.qs()
    const data = await getMaterialsViewModel({
      q: typeof qs.q === 'string' ? qs.q : undefined,
      status: typeof qs.status === 'string' ? qs.status : undefined,
      type: typeof qs.type === 'string' ? qs.type : undefined,
    })
    return inertia.render('catalog/materials', {
      ...data,
      filters: {
        q: typeof qs.q === 'string' ? qs.q : '',
        status: typeof qs.status === 'string' ? qs.status : 'all',
        type: typeof qs.type === 'string' ? qs.type : 'all',
      },
    })
  }

  async updateImage({ params, request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('materials.update' as never)
    const material = await Material.findOrFail(params.id)
    const payload = await request.validateUsing(uploadCatalogImageValidator)
    await storeCatalogImage('material', material, payload.image)
    await audit({
      actor: auth.user!,
      action: 'material.image.update',
      targetType: 'material',
      targetId: material.id,
    })
    session.flash('success', 'Material image updated.')
    return response.redirect().back()
  }

  async destroyImage({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('materials.update' as never)
    const material = await Material.findOrFail(params.id)
    await removeCatalogImage(material)
    await audit({
      actor: auth.user!,
      action: 'material.image.delete',
      targetType: 'material',
      targetId: material.id,
    })
    session.flash('success', 'Material image removed.')
    return response.redirect().back()
  }

  async store({ request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('materials.create' as never)
    const payload = await request.validateUsing(createMaterialValidator)

    const dup = await Material.findBy('sku', payload.sku)
    if (dup) {
      session.flash('errors', { sku: 'A material with this SKU already exists.' })
      return response.redirect().back()
    }

    const material = await Material.create({
      sku: payload.sku,
      name: payload.name,
      type: payload.type,
      unit: payload.unit ?? 'g',
      defaultSupplierId: payload.defaultSupplierId ?? null,
      defaultUnitCost: String(payload.defaultUnitCost),
      reorderThresholdG:
        payload.reorderThresholdG !== undefined ? String(payload.reorderThresholdG) : null,
      isActive: true,
    })
    if (payload.image) {
      await storeCatalogImage('material', material, payload.image)
    }
    await audit({
      actor: auth.user!,
      action: 'material.create',
      targetType: 'material',
      targetId: material.id,
      payload: { ...payload, image: payload.image ? '<file>' : undefined },
    })
    session.flash('success', `Material "${material.name}" created.`)
    return response.redirect().back()
  }

  async update({ params, request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('materials.update' as never)
    const material = await Material.findOrFail(params.id)
    const payload = await request.validateUsing(updateMaterialValidator)

    material.merge({
      ...payload,
      unit: payload.unit ?? material.unit,
      defaultUnitCost:
        payload.defaultUnitCost !== undefined
          ? String(payload.defaultUnitCost)
          : material.defaultUnitCost,
      reorderThresholdG:
        payload.reorderThresholdG === undefined
          ? material.reorderThresholdG
          : payload.reorderThresholdG === null
            ? null
            : String(payload.reorderThresholdG),
    })
    await material.save()
    await audit({
      actor: auth.user!,
      action: 'material.update',
      targetType: 'material',
      targetId: material.id,
      payload,
    })
    session.flash('success', 'Material updated.')
    return response.redirect().back()
  }

  async archive({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('materials.archive' as never)
    const material = await Material.findOrFail(params.id)
    material.isActive = false
    await material.save()
    await audit({
      actor: auth.user!,
      action: 'material.archive',
      targetType: 'material',
      targetId: material.id,
    })
    session.flash('success', 'Material archived.')
    return response.redirect().back()
  }

  async restore({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('materials.archive' as never)
    const material = await Material.findOrFail(params.id)
    material.isActive = true
    await material.save()
    await audit({
      actor: auth.user!,
      action: 'material.restore',
      targetType: 'material',
      targetId: material.id,
    })
    session.flash('success', `Material "${material.name}" restored.`)
    return response.redirect().back()
  }
}
