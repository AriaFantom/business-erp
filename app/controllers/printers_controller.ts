import type { HttpContext } from '@adonisjs/core/http'
import {
  createPrinterValidator,
  printerExpenseValidator,
  updatePrinterValidator,
} from '#validators/printers'
import {
  createPrinter,
  retirePrinter,
  toggleMaintenance,
  updatePrinter,
} from '#services/printer_service'
import { recordExpense } from '#services/job_costing'
import { getPrinterShowViewModel, getPrintersIndexViewModel } from '#services/printers_view_models'
import { DomainError } from '#services/domain_errors'

export default class PrintersController {
  async index({ inertia, bouncer }: HttpContext) {
    await bouncer.authorize('printers.view' as never)
    const data = await getPrintersIndexViewModel()
    return inertia.render('printers/index', data)
  }

  async create({ inertia, bouncer }: HttpContext) {
    await bouncer.authorize('printers.create' as never)
    return inertia.render('printers/new', {})
  }

  async store({ request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('printers.create' as never)
    const payload = await request.validateUsing(createPrinterValidator)
    try {
      const printer = await createPrinter({ ...payload, actor: auth.user! })
      session.flash('success', `Printer "${printer.name}" added.`)
      return response.redirect().toPath(`/printers/${printer.id}`)
    } catch (err) {
      return this._domain(err, response, session)
    }
  }

  async show({ params, inertia, bouncer }: HttpContext) {
    await bouncer.authorize('printers.view' as never)
    const data = await getPrinterShowViewModel(Number(params.id))
    return inertia.render('printers/show', data)
  }

  async update({ params, request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('printers.edit' as never)
    const payload = await request.validateUsing(updatePrinterValidator)
    try {
      await updatePrinter(Number(params.id), payload, auth.user!)
      session.flash('success', 'Printer updated.')
    } catch (err) {
      return this._domain(err, response, session)
    }
    return response.redirect().back()
  }

  async retire({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('printers.retire' as never)
    try {
      await retirePrinter(Number(params.id), auth.user!)
      session.flash('success', 'Printer retired.')
    } catch (err) {
      return this._domain(err, response, session)
    }
    return response.redirect().back()
  }

  async toggleMaintenance({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('printers.edit' as never)
    try {
      await toggleMaintenance(Number(params.id), auth.user!)
      session.flash('success', 'Printer maintenance state toggled.')
    } catch (err) {
      return this._domain(err, response, session)
    }
    return response.redirect().back()
  }

  async addExpense({ params, request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('printers.edit' as never)
    const payload = await request.validateUsing(printerExpenseValidator)
    try {
      await recordExpense({
        printerId: Number(params.id),
        kind: payload.kind,
        description: payload.description,
        amount: payload.amount,
        incurredAt: payload.incurredAt ?? undefined,
        actor: auth.user!,
      })
      session.flash('success', 'Expense recorded.')
    } catch (err) {
      return this._domain(err, response, session)
    }
    return response.redirect().back()
  }

  private _domain(
    err: unknown,
    response: HttpContext['response'],
    session: HttpContext['session']
  ) {
    if (err instanceof DomainError) {
      session.flash('error', err.message)
      return response.redirect().back()
    }
    throw err
  }
}
