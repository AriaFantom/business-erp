import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Product from '#models/product'
import ProductAttachment from '#models/product_attachment'
import {
  createProductValidator,
  updateProductValidator,
  uploadCatalogImageValidator,
  uploadProductFileValidator,
  setProductDefaultPriceValidator,
} from '#validators/catalog'
import { getProductsViewModel, getProductShowViewModel } from '#services/catalog_view_models'
import { audit } from '#services/audit'
import { storeCatalogImage, removeCatalogImage } from '#services/catalog_image_storage'
import {
  storeProductFile,
  removeProductFile,
  signProductFileUrl,
  listProductAttachments,
} from '#services/product_attachment_storage'
import { qrPayload, renderQrSvg, renderQrPngBuffer } from '#services/product_qr'

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

  async show({ params, inertia, bouncer }: HttpContext) {
    await bouncer.authorize('products.view' as never)
    const data = await getProductShowViewModel(Number(params.id))
    return inertia.render('catalog/products/show', data)
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

  async restore({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('products.archive' as never)
    const product = await Product.findOrFail(params.id)
    product.isActive = true
    await product.save()
    await audit({
      actor: auth.user!,
      action: 'product.restore',
      targetType: 'product',
      targetId: product.id,
    })
    session.flash('success', `Product "${product.name}" restored.`)
    return response.redirect().back()
  }

  async listFiles({ params, response, bouncer }: HttpContext) {
    await bouncer.authorize('products.view' as never)
    const product = await Product.findOrFail(params.id)
    const attachments = await listProductAttachments(product.id)
    return response.json({
      data: attachments.map((a) => ({
        id: a.id,
        originalName: a.originalName,
        sizeBytes: a.sizeBytes,
        mimeType: a.mimeType,
        createdAt: a.createdAt.toISO(),
      })),
    })
  }

  async uploadFile({ params, request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('products.update' as never)
    const product = await Product.findOrFail(params.id)
    const payload = await request.validateUsing(uploadProductFileValidator)
    const attachment = await storeProductFile(product, payload.file, auth.user?.id ?? null)
    await audit({
      actor: auth.user!,
      action: 'product.file.add',
      targetType: 'product',
      targetId: product.id,
      payload: { attachmentId: attachment.id, name: attachment.originalName },
    })
    session.flash('success', `Attached "${attachment.originalName}".`)
    return response.redirect().back()
  }

  async destroyFile({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('products.update' as never)
    const attachment = await ProductAttachment.findOrFail(params.fileId)
    if (attachment.productId !== Number(params.id)) {
      session.flash('error', 'Attachment does not belong to this product.')
      return response.redirect().back()
    }
    const name = attachment.originalName
    await removeProductFile(attachment)
    await audit({
      actor: auth.user!,
      action: 'product.file.delete',
      targetType: 'product',
      targetId: Number(params.id),
      payload: { name },
    })
    session.flash('success', `Removed "${name}".`)
    return response.redirect().back()
  }

  async downloadFile({ params, response, bouncer }: HttpContext) {
    await bouncer.authorize('products.view' as never)
    const attachment = await ProductAttachment.findOrFail(params.fileId)
    if (attachment.productId !== Number(params.id)) {
      return response.notFound()
    }
    const url = await signProductFileUrl(attachment)
    if (!url) return response.internalServerError({ error: 'Could not sign URL' })
    return response.redirect(url)
  }

  async qr({ params, response, bouncer }: HttpContext) {
    await bouncer.authorize('products.view' as never)
    const product = await Product.findOrFail(params.id)
    const svg = await renderQrSvg(qrPayload(product))
    response.header('Cache-Control', 'public, max-age=300')
    response.type('image/svg+xml')
    return response.send(svg)
  }

  async qrDownload({ params, response, bouncer }: HttpContext) {
    await bouncer.authorize('products.view' as never)
    const product = await Product.findOrFail(params.id)
    const png = await renderQrPngBuffer(qrPayload(product))
    response.header('Content-Disposition', `attachment; filename="${product.sku}-qr.png"`)
    response.type('image/png')
    return response.send(png)
  }

  async setDefaultPrice({ params, request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('products.update' as never)
    const product = await Product.findOrFail(params.id)
    const payload = await request.validateUsing(setProductDefaultPriceValidator)

    const previousPrice = product.defaultSalePrice
    product.merge({
      defaultSalePrice: String(payload.price),
      defaultSalePriceSourceJobId: payload.sourceJobId ?? null,
      defaultSalePriceSetAt: DateTime.now(),
      defaultSalePriceSetByUserId: auth.user?.id ?? null,
    })
    await product.save()

    await audit({
      actor: auth.user!,
      action: 'product.default_price.set',
      targetType: 'product',
      targetId: product.id,
      payload: { price: payload.price, sourceJobId: payload.sourceJobId ?? null, previousPrice },
    })
    session.flash('success', `Default price set to ₹${payload.price}.`)
    return response.redirect().back()
  }

  async clearDefaultPrice({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('products.update' as never)
    const product = await Product.findOrFail(params.id)
    const previousPrice = product.defaultSalePrice
    const previousSourceJobId = product.defaultSalePriceSourceJobId

    product.merge({
      defaultSalePrice: null,
      defaultSalePriceSourceJobId: null,
      defaultSalePriceSetAt: null,
      defaultSalePriceSetByUserId: null,
    })
    await product.save()

    await audit({
      actor: auth.user!,
      action: 'product.default_price.clear',
      targetType: 'product',
      targetId: product.id,
      payload: { previousPrice, previousSourceJobId },
    })
    session.flash('success', 'Default price cleared.')
    return response.redirect().back()
  }
}
