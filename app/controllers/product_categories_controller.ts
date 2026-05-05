import type { HttpContext } from '@adonisjs/core/http'
import ProductCategory from '#models/product_category'
import Product from '#models/product'
import { createProductCategoryValidator, updateProductCategoryValidator } from '#validators/catalog'
import { getProductCategoriesViewModel } from '#services/catalog_view_models'
import { audit } from '#services/audit'

export default class ProductCategoriesController {
  async index({ inertia, bouncer }: HttpContext) {
    await bouncer.authorize('productCategories.view' as never)
    const data = await getProductCategoriesViewModel()
    return inertia.render('catalog/categories', data)
  }

  async store({ request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('productCategories.create' as never)
    const payload = await request.validateUsing(createProductCategoryValidator)

    const dup = await ProductCategory.findBy('name', payload.name)
    if (dup) {
      session.flash('errors', { name: 'A category with this name already exists.' })
      return response.redirect().back()
    }

    const cat = await ProductCategory.create({
      name: payload.name,
      defaultProfitPct:
        payload.defaultProfitPct !== undefined ? String(payload.defaultProfitPct) : null,
      taxRatePct: payload.taxRatePct !== undefined ? String(payload.taxRatePct) : null,
    })
    await audit({
      actor: auth.user!,
      action: 'product_category.create',
      targetType: 'product_category',
      targetId: cat.id,
      payload,
    })
    session.flash('success', `Category "${cat.name}" created.`)
    return response.redirect().back()
  }

  async update({ params, request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('productCategories.update' as never)
    const cat = await ProductCategory.findOrFail(params.id)
    const payload = await request.validateUsing(updateProductCategoryValidator)

    cat.merge({
      name: payload.name ?? cat.name,
      defaultProfitPct:
        payload.defaultProfitPct === undefined
          ? cat.defaultProfitPct
          : payload.defaultProfitPct === null
            ? null
            : String(payload.defaultProfitPct),
      taxRatePct:
        payload.taxRatePct === undefined
          ? cat.taxRatePct
          : payload.taxRatePct === null
            ? null
            : String(payload.taxRatePct),
    })
    await cat.save()
    await audit({
      actor: auth.user!,
      action: 'product_category.update',
      targetType: 'product_category',
      targetId: cat.id,
      payload,
    })
    session.flash('success', 'Category updated.')
    return response.redirect().back()
  }

  async destroy({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('productCategories.delete' as never)
    const cat = await ProductCategory.findOrFail(params.id)

    const inUse = await Product.query().where('category_id', cat.id).first()
    if (inUse) {
      session.flash('error', 'Reassign products before deleting this category.')
      return response.redirect().back()
    }

    await cat.delete()
    await audit({
      actor: auth.user!,
      action: 'product_category.delete',
      targetType: 'product_category',
      targetId: cat.id,
    })
    session.flash('success', 'Category deleted.')
    return response.redirect().back()
  }
}
