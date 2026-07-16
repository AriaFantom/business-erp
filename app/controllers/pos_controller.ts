import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Customer from '#models/customer'
import Product from '#models/product'
import ProductCategory from '#models/product_category'
import {
  posSellValidator,
  openCashSessionValidator,
  closeCashSessionValidator,
} from '#validators/pos'
import { completePosOrder } from '#services/pos_service'
import {
  getOpenSession,
  getSessionSummary,
  openSession,
  closeSession,
} from '#services/cash_session_service'
import { token } from '#services/file_streaming'
import { computeUnitPrice } from '#services/pricing'
import { latestProductCost } from '#services/job_costing'
import { withIdempotency } from '#services/idempotency'
import { DomainError } from '#services/domain_errors'

export default class PosController {
  async index({ request, inertia, bouncer }: HttpContext) {
    await bouncer.authorize('pos.view' as never)
    const canManageSession = await bouncer.allows('pos.manageSession' as never)
    const openSess = await getOpenSession()
    let cashSession: {
      id: number
      number: string
      openedAt: string | null
      openingFloat: number
      summary: { byMethod: Record<string, string>; salesCount: number; expectedCash: number }
    } | null = null
    if (openSess) {
      const summary = await getSessionSummary(openSess)
      const byMethod: Record<string, string> = {}
      for (const [method, total] of Object.entries(summary.byMethod)) {
        byMethod[method] = total.toFixed(2)
      }
      cashSession = {
        id: openSess.id,
        number: openSess.number,
        openedAt: openSess.openedAt.toISO(),
        openingFloat: Number(openSess.openingFloat),
        summary: { byMethod, salesCount: summary.salesCount, expectedCash: summary.expectedCash },
      }
    }
    const qs = request.qs()
    const q = typeof qs.q === 'string' ? qs.q : ''
    const categoryId = qs.categoryId ? Number(qs.categoryId) : null

    // Only surface products that currently have stock available (inventory
    // qty > 0 for itemKind = 'product'). Filtering happens in SQL so empty
    // rows never reach the client.
    const stockRows = await db
      .from('inventory')
      .where('item_kind', 'product')
      .where('qty', '>', 0)
      .select('item_id', 'qty')
    const stockByProduct = new Map<number, number>(
      stockRows.map((r) => [Number(r.item_id), Number(r.qty)])
    )
    const inStockIds = [...stockByProduct.keys()]

    let products: Product[] = []
    if (inStockIds.length > 0) {
      const productsQ = Product.query()
        .where('is_active', true)
        .whereIn('id', inStockIds)
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
    const cats = categoryIds.length ? await ProductCategory.query().whereIn('id', categoryIds) : []
    const catById = new Map(cats.map((c) => [c.id, c]))

    // Cost basis per product. Must use the same source as the server-side
    // price enforcement (resolveOrderLinePricing → latestProductCost), so the
    // suggested price shown here matches what checkout will accept.
    const costs = await Promise.all(products.map((p) => latestProductCost(p.id)))
    const costByProduct = new Map<number, number>()
    products.forEach((p, idx) => costByProduct.set(p.id, costs[idx] ?? 0))

    const [categories, customers] = await Promise.all([
      ProductCategory.query().orderBy('name', 'asc'),
      Customer.query().where('is_active', true).orderBy('name', 'asc'),
    ])

    return inertia.render('pos/index', {
      products: products.map((p) => {
        const cost = costByProduct.get(p.id) ?? 0
        const breakdown = computeUnitPrice({
          costPrice: cost,
          product: p,
          category: p.categoryId ? (catById.get(p.categoryId) ?? null) : null,
        })
        return {
          id: p.id,
          sku: p.sku,
          name: p.name,
          category: p.category ? { id: p.category.id, name: p.category.name } : null,
          imageUrl: p.imageKey ? `/catalog/products/${p.id}/image?v=${token(p.imageKey)}` : null,
          unitCost: Math.round(cost * 10000) / 10000,
          profitPct: breakdown.profitPctUsed ?? 0,
          taxRatePct: breakdown.taxRatePct,
          suggestedUnitPrice: breakdown.unitPrice,
          stockQty: stockByProduct.get(p.id) ?? 0,
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
      cashSession,
      canManageSession,
    })
  }

  async sell({ request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('pos.sell' as never)
    const payload = await request.validateUsing(posSellValidator)
    const allowPriceOverride = await bouncer.allows('orders.overridePrice' as never)
    try {
      const run = () =>
        completePosOrder({
          customerId: payload.customerId,
          items: payload.items,
          paymentMethod: payload.paymentMethod,
          paymentReference: payload.paymentReference ?? null,
          allowPriceOverride,
          actor: auth.user!,
        })

      let result: Awaited<ReturnType<typeof run>>
      let replayed = false
      if (payload.idempotencyKey) {
        const outcome = await withIdempotency({
          actor: auth.user!,
          route: 'pos.sell',
          key: payload.idempotencyKey,
          run,
        })
        result = outcome.value
        replayed = outcome.replayed
      } else {
        result = await run()
      }

      if (replayed) {
        session.flash('success', 'Duplicate submission — showing the original order.')
      } else {
        session.flash('success', `Order completed (${result.total.toFixed(2)}). Invoice ready.`)
      }
      return response.redirect(`/invoices/${result.invoiceId}`)
    } catch (err) {
      if (err instanceof DomainError) {
        session.flash('error', err.message)
        return response.redirect().back()
      }
      throw err
    }
  }

  async openSession({ request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('pos.manageSession' as never)
    const payload = await request.validateUsing(openCashSessionValidator)
    try {
      const cashSession = await openSession({
        openingFloat: payload.openingFloat,
        actor: auth.user!,
      })
      session.flash('success', `Cash session ${cashSession.number} opened.`)
      return response.redirect().back()
    } catch (err) {
      if (err instanceof DomainError) {
        session.flash('error', err.message)
        return response.redirect().back()
      }
      throw err
    }
  }

  async closeSession({ request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('pos.manageSession' as never)
    const payload = await request.validateUsing(closeCashSessionValidator)
    try {
      const cashSession = await closeSession({
        countedCash: payload.countedCash,
        note: payload.note ?? null,
        actor: auth.user!,
      })
      const variance = Number(cashSession.variance)
      const varianceLabel = variance === 0 ? 'no variance' : `variance ${variance.toFixed(2)}`
      session.flash('success', `Cash session ${cashSession.number} closed (${varianceLabel}).`)
      return response.redirect().back()
    } catch (err) {
      if (err instanceof DomainError) {
        session.flash('error', err.message)
        return response.redirect().back()
      }
      throw err
    }
  }
}
