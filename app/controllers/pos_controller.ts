import type { HttpContext } from '@adonisjs/core/http'
import Customer from '#models/customer'
import Product from '#models/product'
import ProductCategory from '#models/product_category'
import { posSellValidator } from '#validators/pos'
import { completePosSale } from '#services/pos_service'
import { signCatalogImageUrl } from '#services/catalog_image_storage'
import { DomainError } from '#services/domain_errors'

export default class PosController {
  async index({ request, inertia, bouncer }: HttpContext) {
    await bouncer.authorize('pos.view' as never)
    const qs = request.qs()
    const q = typeof qs.q === 'string' ? qs.q : ''
    const categoryId = qs.categoryId ? Number(qs.categoryId) : null

    const productsQ = Product.query()
      .where('is_active', true)
      .preload('category')
      .orderBy('name', 'asc')
    if (categoryId) productsQ.where('category_id', categoryId)
    if (q) {
      const needle = `%${q.trim()}%`
      productsQ.where((sub) => {
        sub.whereILike('name', needle).orWhereILike('sku', needle)
      })
    }

    const [products, categories, customers] = await Promise.all([
      productsQ,
      ProductCategory.query().orderBy('name', 'asc'),
      Customer.query().where('is_active', true).orderBy('name', 'asc'),
    ])

    const signed = await Promise.all(products.map((p) => signCatalogImageUrl(p.imageKey)))

    return inertia.render('pos/index', {
      products: products.map((p, idx) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category ? { id: p.category.id, name: p.category.name } : null,
        defaultProfitPct: p.defaultProfitPct,
        taxRatePct: p.taxRatePct,
        imageUrl: signed[idx],
      })),
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        defaultProfitPct: c.defaultProfitPct,
        taxRatePct: c.taxRatePct,
      })),
      customers: customers.map((c) => ({ id: c.id, name: c.name })),
      filters: {
        q,
        categoryId: categoryId ? String(categoryId) : 'all',
      },
    })
  }

  async sell({ request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('pos.sell' as never)
    const payload = await request.validateUsing(posSellValidator)
    try {
      const result = await completePosSale({
        customerId: payload.customerId,
        items: payload.items,
        paymentMethod: payload.paymentMethod,
        paymentReference: payload.paymentReference ?? null,
        actor: auth.user!,
      })
      session.flash('success', `Sale completed (${result.total.toFixed(2)}). Invoice ready.`)
      return response.redirect(`/invoices/${result.invoiceId}`)
    } catch (err) {
      if (err instanceof DomainError) {
        session.flash('error', err.message)
        return response.redirect().back()
      }
      throw err
    }
  }
}
