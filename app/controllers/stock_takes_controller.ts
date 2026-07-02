import type { HttpContext } from '@adonisjs/core/http'
import { createStockTakeValidator, saveStockTakeCountsValidator } from '#validators/stock_takes'
import {
  getStockTakesIndexViewModel,
  getStockTakeShowViewModel,
} from '#services/stock_takes_view_models'
import {
  cancelStockTake,
  completeStockTake,
  createStockTake,
  refreshExpected,
  saveCounts,
} from '#services/stock_take_service'
import { DomainError } from '#services/domain_errors'

export default class StockTakesController {
  async index({ inertia, bouncer }: HttpContext) {
    await bouncer.authorize('inventory.view' as never)
    const data = await getStockTakesIndexViewModel()
    return inertia.render('inventory/stock-takes/index', data)
  }

  async show({ params, inertia, bouncer }: HttpContext) {
    await bouncer.authorize('inventory.view' as never)
    const data = await getStockTakeShowViewModel(Number(params.id))
    return inertia.render('inventory/stock-takes/show', data)
  }

  async store({ request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('inventory.stockTake' as never)
    const payload = await request.validateUsing(createStockTakeValidator)

    try {
      const st = await createStockTake({ note: payload.note ?? null, actor: auth.user! })
      session.flash('success', `Stock take ${st.number} created.`)
      return response.redirect().toPath(`/inventory/stock-takes/${st.id}`)
    } catch (err) {
      if (err instanceof DomainError) {
        session.flash('error', err.message)
        return response.redirect().back()
      }
      throw err
    }
  }

  async saveCounts({ params, request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('inventory.stockTake' as never)
    const payload = await request.validateUsing(saveStockTakeCountsValidator)

    try {
      await saveCounts({
        stockTakeId: Number(params.id),
        counts: payload.counts,
        actor: auth.user!,
      })
      session.flash('success', 'Counts saved.')
    } catch (err) {
      if (err instanceof DomainError) {
        session.flash('error', err.message)
        return response.redirect().back()
      }
      throw err
    }
    return response.redirect().back()
  }

  async refresh({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('inventory.stockTake' as never)

    try {
      await refreshExpected({ stockTakeId: Number(params.id), actor: auth.user! })
      session.flash('success', 'Expected quantities refreshed.')
    } catch (err) {
      if (err instanceof DomainError) {
        session.flash('error', err.message)
        return response.redirect().back()
      }
      throw err
    }
    return response.redirect().back()
  }

  async complete({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('inventory.stockTake' as never)

    try {
      const st = await completeStockTake({ stockTakeId: Number(params.id), actor: auth.user! })
      session.flash('success', `Stock take ${st.number} completed; inventory adjusted.`)
    } catch (err) {
      if (err instanceof DomainError) {
        session.flash('error', err.message)
        return response.redirect().back()
      }
      throw err
    }
    return response.redirect().back()
  }

  async cancel({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('inventory.stockTake' as never)

    try {
      const st = await cancelStockTake({ stockTakeId: Number(params.id), actor: auth.user! })
      session.flash('success', `Stock take ${st.number} cancelled.`)
    } catch (err) {
      if (err instanceof DomainError) {
        session.flash('error', err.message)
        return response.redirect().back()
      }
      throw err
    }
    return response.redirect().back()
  }
}
