import type { HttpContext } from '@adonisjs/core/http'
import Product from '#models/product'
import { createProductValidator, updateProductValidator } from '#validators/catalog'
import { getProductsViewModel } from '#services/catalog_view_models'
import { audit } from '#services/audit'

export default class ProductsController {
  async index({ inertia, bouncer }: HttpContext) {
    await bouncer.authorize('products.view' as never)
    const data = await getProductsViewModel()
    return inertia.render('catalog/products', data)
  }

  async store({ request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('products.create' as never)
    const payload = await request.validateUsing(createProductValidator)

    const dup = await Product.findBy('sku', payload.sku)
    if (dup) {
      session.flash('errors', { sku: 'A product with this SKU already exists.' })
      return response.redirect().back()
    }

    const product = await Product.create({
      sku: payload.sku,
      name: payload.name,
      description: payload.description ?? null,
      categoryId: payload.categoryId ?? null,
      defaultProfitPct:
        payload.defaultProfitPct !== undefined ? String(payload.defaultProfitPct) : null,
      taxRatePct: payload.taxRatePct !== undefined ? String(payload.taxRatePct) : null,
      isActive: true,
    })
    await audit({
      actor: auth.user!,
      action: 'product.create',
      targetType: 'product',
      targetId: product.id,
      payload,
    })
    session.flash('success', `Product "${product.name}" created.`)
    return response.redirect().back()
  }

  async update({ params, request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('products.update' as never)
    const product = await Product.findOrFail(params.id)
    const payload = await request.validateUsing(updateProductValidator)

    product.merge({
      ...payload,
      defaultProfitPct:
        payload.defaultProfitPct === undefined
          ? product.defaultProfitPct
          : payload.defaultProfitPct === null
            ? null
            : String(payload.defaultProfitPct),
      taxRatePct:
        payload.taxRatePct === undefined
          ? product.taxRatePct
          : payload.taxRatePct === null
            ? null
            : String(payload.taxRatePct),
    })
    await product.save()
    await audit({
      actor: auth.user!,
      action: 'product.update',
      targetType: 'product',
      targetId: product.id,
      payload,
    })
    session.flash('success', 'Product updated.')
    return response.redirect().back()
  }

  async archive({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('products.archive' as never)
    const product = await Product.findOrFail(params.id)
    product.isActive = false
    await product.save()
    await audit({
      actor: auth.user!,
      action: 'product.archive',
      targetType: 'product',
      targetId: product.id,
    })
    session.flash('success', 'Product archived.')
    return response.redirect().back()
  }
}
