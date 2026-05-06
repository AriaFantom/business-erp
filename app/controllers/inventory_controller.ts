import type { HttpContext } from '@adonisjs/core/http'
import { adjustInventoryValidator } from '#validators/catalog'
import { getInventoryViewModel } from '#services/catalog_view_models'
import { adjustStock } from '#services/inventory_service'
import { DomainError } from '#services/domain_errors'

export default class InventoryController {
  async index({ request, inertia, bouncer }: HttpContext) {
    await bouncer.authorize('inventory.view' as never)
    const qs = request.qs()
    const data = await getInventoryViewModel({
      q: typeof qs.q === 'string' ? qs.q : undefined,
      itemKind: typeof qs.itemKind === 'string' ? qs.itemKind : undefined,
      lowStock: qs.lowStock === '1' || qs.lowStock === 'true',
    })
    return inertia.render('inventory/index', {
      ...data,
      filters: {
        q: typeof qs.q === 'string' ? qs.q : '',
        itemKind: typeof qs.itemKind === 'string' ? qs.itemKind : 'all',
        lowStock: qs.lowStock === '1' || qs.lowStock === 'true',
      },
    })
  }

  /** POST /inventory/adjustments — manual stock correction */
  async adjust({ request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('inventory.adjust' as never)
    const payload = await request.validateUsing(adjustInventoryValidator)

    if (payload.qtyDelta === 0) {
      session.flash('error', 'Adjustment cannot be zero.')
      return response.redirect().back()
    }

    try {
      await adjustStock({
        itemKind: payload.itemKind,
        itemId: payload.itemId,
        qtyDelta: payload.qtyDelta,
        unitCost: payload.unitCost,
        note: payload.note,
        actor: auth.user!,
      })
    } catch (err) {
      if (err instanceof DomainError) {
        session.flash('error', err.message)
        return response.redirect().back()
      }
      throw err
    }

    session.flash('success', 'Inventory adjusted.')
    return response.redirect().back()
  }
}
