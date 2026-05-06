import type { HttpContext } from '@adonisjs/core/http'
import Product from '#models/product'
import {
  createProductValidator,
  updateProductValidator,
  uploadCatalogImageValidator,
} from '#validators/catalog'
import { getProductsViewModel } from '#services/catalog_view_models'
import { audit } from '#services/audit'
import { storeCatalogImage, removeCatalogImage } from '#services/catalog_image_storage'

export default class ProductsController {
  async index({ request, inertia, bouncer }: HttpContext) {
    await bouncer.authorize('products.view' as never)
    const qs = request.qs()
    const data = await getProductsViewModel({
      q: typeof qs.q === 'string' ? qs.q : undefined,
      status: typeof qs.status === 'string' ? qs.status : undefined,
      categoryId: qs.categoryId ? Number(qs.categoryId) : undefined,
    })
    return inertia.render('catalog/products', {
      ...data,
      filters: {
        q: typeof qs.q === 'string' ? qs.q : '',
        status: typeof qs.status === 'string' ? qs.status : 'all',
        categoryId: qs.categoryId ? String(qs.categoryId) : 'all',
      },
    })
  }

  async updateImage({ params, request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('products.update' as never)
    const product = await Product.findOrFail(params.id)
    const payload = await request.validateUsing(uploadCatalogImageValidator)
    await storeCatalogImage('product', product, payload.image)
    await audit({
      actor: auth.user!,
      action: 'product.image.update',
      targetType: 'product',
      targetId: product.id,
    })
    session.flash('success', 'Product image updated.')
    return response.redirect().back()
  }

  async destroyImage({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('products.update' as never)
    const product = await Product.findOrFail(params.id)
    await removeCatalogImage(product)
    await audit({
      actor: auth.user!,
      action: 'product.image.delete',
      targetType: 'product',
      targetId: product.id,
    })
    session.flash('success', 'Product image removed.')
    return response.redirect().back()
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
