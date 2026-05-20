import type { HttpContext } from '@adonisjs/core/http'
import {
  createMachineValidator,
  machineExpenseValidator,
  updateMachineValidator,
} from '#validators/machines'
import {
  createMachine,
  retireMachine,
  toggleMaintenance,
  updateMachine,
} from '#services/machine_service'
import { recordExpense } from '#services/job_costing'
import { getMachineShowViewModel, getMachinesIndexViewModel } from '#services/machines_view_models'
import { DomainError } from '#services/domain_errors'

export default class MachinesController {
  async index({ inertia, bouncer, request }: HttpContext) {
    await bouncer.authorize('machines.view' as never)
    const data = await getMachinesIndexViewModel({
      q: request.input('q'),
      status: request.input('status'),
    })
    return inertia.render('machines/index', data)
  }

  async create({ inertia, bouncer }: HttpContext) {
    await bouncer.authorize('machines.create' as never)
    return inertia.render('machines/new', {})
  }

  async store({ request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('machines.create' as never)
    const payload = await request.validateUsing(createMachineValidator)
    try {
      const machine = await createMachine({ ...payload, actor: auth.user! })
      session.flash('success', `Machine "${machine.name}" added.`)
      return response.redirect().toPath(`/machines/${machine.id}`)
    } catch (err) {
      return this._domain(err, response, session)
    }
  }

  async show({ params, inertia, bouncer }: HttpContext) {
    await bouncer.authorize('machines.view' as never)
    const data = await getMachineShowViewModel(Number(params.id))
    return inertia.render('machines/show', data)
  }

  async update({ params, request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('machines.edit' as never)
    const payload = await request.validateUsing(updateMachineValidator)
    try {
      await updateMachine(Number(params.id), payload, auth.user!)
      session.flash('success', 'Machine updated.')
    } catch (err) {
      return this._domain(err, response, session)
    }
    return response.redirect().back()
  }

  async retire({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('machines.retire' as never)
    try {
      await retireMachine(Number(params.id), auth.user!)
      session.flash('success', 'Machine retired.')
    } catch (err) {
      return this._domain(err, response, session)
    }
    return response.redirect().back()
  }

  async toggleMaintenance({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('machines.edit' as never)
    try {
      await toggleMaintenance(Number(params.id), auth.user!)
      session.flash('success', 'Machine maintenance state toggled.')
    } catch (err) {
      return this._domain(err, response, session)
    }
    return response.redirect().back()
  }

  async addExpense({ params, request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('machines.edit' as never)
    const payload = await request.validateUsing(machineExpenseValidator)
    try {
      await recordExpense({
        machineId: Number(params.id),
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
