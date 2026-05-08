import type { HttpContext } from '@adonisjs/core/http'
import ProductCategory from '#models/product_category'
import Product from '#models/product'
import { createProductCategoryValidator, updateProductCategoryValidator } from '#validators/catalog'
import { getProductCategoriesViewModel } from '#services/catalog_view_models'
import { audit } from '#services/audit'

export default class ProductCategoriesController {
  async index({ request, inertia, bouncer }: HttpContext) {
    await bouncer.authorize('productCategories.view' as never)
    const qs = request.qs()
    const data = await getProductCategoriesViewModel({
      q: typeof qs.q === 'string' ? qs.q : undefined,
      status: typeof qs.status === 'string' ? qs.status : undefined,
    })
    return inertia.render('catalog/categories', {
      ...data,
      filters: {
        q: typeof qs.q === 'string' ? qs.q : '',
        status: typeof qs.status === 'string' ? qs.status : 'all',
      },
    })
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
      isActive: true,
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

  async archive({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('productCategories.delete' as never)
    const cat = await ProductCategory.findOrFail(params.id)

    const activeProductInCat = await Product.query()
      .where('category_id', cat.id)
      .where('is_active', true)
      .first()
    if (activeProductInCat) {
      session.flash(
        'error',
        'This category is still used by active products. Archive or reassign them first.'
      )
      return response.redirect().back()
    }

    cat.isActive = false
    await cat.save()
    await audit({
      actor: auth.user!,
      action: 'product_category.archive',
      targetType: 'product_category',
      targetId: cat.id,
    })
    session.flash('success', `Category "${cat.name}" archived.`)
    return response.redirect().back()
  }

  async restore({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('productCategories.delete' as never)
    const cat = await ProductCategory.findOrFail(params.id)
    cat.isActive = true
    await cat.save()
    await audit({
      actor: auth.user!,
      action: 'product_category.restore',
      targetType: 'product_category',
      targetId: cat.id,
    })
    session.flash('success', `Category "${cat.name}" restored.`)
    return response.redirect().back()
  }
}
