import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Customer from '#models/customer'
import Product from '#models/product'
import ProductCategory from '#models/product_category'
import { posSellValidator } from '#validators/pos'
import { completePosSale } from '#services/pos_service'
import { signCatalogImageUrl } from '#services/catalog_image_storage'
import { computeUnitPrice } from '#services/pricing'
import { DomainError } from '#services/domain_errors'

export default class PosController {
  async index({ request, inertia, bouncer }: HttpContext) {
    await bouncer.authorize('pos.view' as never)
    const qs = request.qs()
    const q = typeof qs.q === 'string' ? qs.q : ''
    const categoryId = qs.categoryId ? Number(qs.categoryId) : null

    // Only surface products that have been produced (at least one completed
    // job with produced_qty > 0). Filtering happens in SQL so unsellable rows
    // never reach the client.
    const producibleIdsRaw = await db
      .from('production_jobs')
      .where('status', 'completed')
      .where('produced_qty', '>', 0)
      .distinct('product_id')
      .select('product_id')
    const producibleIds = producibleIdsRaw.map((r) => Number(r.product_id))

    let products: Product[] = []
    if (producibleIds.length > 0) {
      const productsQ = Product.query()
        .where('is_active', true)
        .whereIn('id', producibleIds)
        .preload('category')
        .orderBy('name', 'asc')
      if (categoryId) productsQ.where('category_id', categoryId)
      if (q) {
        const needle = `%${q.trim()}%`
        productsQ.where((sub) => {
          sub.whereILike('name', needle).orWhereILike('sku', needle)
        })
      }
      products = await productsQ
    }

    const categoryIds = [
      ...new Set(products.map((p) => p.categoryId).filter((id): id is number => !!id)),
    ]
    const cats = categoryIds.length
      ? await ProductCategory.query().whereIn('id', categoryIds)
      : []
    const catById = new Map(cats.map((c) => [c.id, c]))

    // Latest completed-job unit cost per product, weighted by produced_qty.
    const costRows =
      products.length > 0
        ? await db
            .from('production_jobs')
            .whereIn(
              'product_id',
              products.map((p) => p.id)
            )
            .where('status', 'completed')
            .where('produced_qty', '>', 0)
            .groupBy('product_id')
            .select('product_id')
            .sum({ totalCost: 'total_cost' })
            .sum({ totalQty: 'produced_qty' })
        : []
    const costByProduct = new Map<number, number>()
    for (const row of costRows) {
      const total = Number(row.totalCost ?? 0)
      const qty = Number(row.totalQty ?? 0)
      costByProduct.set(Number(row.product_id), qty > 0 ? total / qty : 0)
    }

    const signed = await Promise.all(products.map((p) => signCatalogImageUrl(p.imageKey)))

    const [categories, customers] = await Promise.all([
      ProductCategory.query().orderBy('name', 'asc'),
      Customer.query().where('is_active', true).orderBy('name', 'asc'),
    ])

    return inertia.render('pos/index', {
      products: products.map((p, idx) => {
        const cost = costByProduct.get(p.id) ?? 0
        const breakdown = computeUnitPrice({
          costPrice: cost,
          product: p,
          category: p.categoryId ? catById.get(p.categoryId) ?? null : null,
        })
        return {
          id: p.id,
          sku: p.sku,
          name: p.name,
          category: p.category ? { id: p.category.id, name: p.category.name } : null,
          imageUrl: signed[idx],
          unitCost: Math.round(cost * 10000) / 10000,
          profitPct: breakdown.profitPctUsed ?? 0,
          taxRatePct: breakdown.taxRatePct,
          suggestedUnitPrice: breakdown.unitPrice,
        }
      }),
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
      session.flash(
        'success',
        `Sale completed (${result.total.toFixed(2)}). Invoice ready.`
      )
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
