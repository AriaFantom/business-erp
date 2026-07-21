import type { HttpContext } from '@adonisjs/core/http'
import {
  createWorkerValidator,
  updateWorkerValidator,
  workerPaymentValidator,
} from '#validators/workers'
import {
  createWorker,
  deactivateWorker,
  reactivateWorker,
  recordWorkerPayment,
  updateWorker,
} from '#services/worker_service'
import { getWorkerShowViewModel, getWorkersIndexViewModel } from '#services/workers_view_models'
import { DomainError } from '#services/domain_errors'

export default class WorkersController {
  async index({ inertia, bouncer, request }: HttpContext) {
    await bouncer.authorize('workers.view' as never)
    const data = await getWorkersIndexViewModel({
      q: request.input('q'),
      status: request.input('status'),
      payType: request.input('payType'),
    })
    return inertia.render('workers/index', data)
  }

  async create({ inertia, bouncer }: HttpContext) {
    await bouncer.authorize('workers.create' as never)
    return inertia.render('workers/new', {})
  }

  async store({ request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('workers.create' as never)
    const payload = await request.validateUsing(createWorkerValidator)
    try {
      const worker = await createWorker({
        ...payload,
        joinedAt: payload.joinedAt ?? undefined,
        actor: auth.user!,
      })
      session.flash('success', `Worker "${worker.name}" added.`)
      return response.redirect().toPath(`/workers/${worker.id}`)
    } catch (err) {
      return this._domain(err, response, session)
    }
  }

  async show({ params, inertia, bouncer }: HttpContext) {
    await bouncer.authorize('workers.view' as never)
    const data = await getWorkerShowViewModel(Number(params.id))
    return inertia.render('workers/show', data)
  }

  async update({ params, request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('workers.update' as never)
    const payload = await request.validateUsing(updateWorkerValidator)
    try {
      await updateWorker(Number(params.id), payload, auth.user!)
      session.flash('success', 'Worker updated.')
    } catch (err) {
      return this._domain(err, response, session)
    }
    return response.redirect().back()
  }

  async retire({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('workers.retire' as never)
    try {
      await deactivateWorker(Number(params.id), auth.user!)
      session.flash('success', 'Worker deactivated.')
    } catch (err) {
      return this._domain(err, response, session)
    }
    return response.redirect().back()
  }

  async reactivate({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('workers.retire' as never)
    try {
      await reactivateWorker(Number(params.id), auth.user!)
      session.flash('success', 'Worker reactivated.')
    } catch (err) {
      return this._domain(err, response, session)
    }
    return response.redirect().back()
  }

  async storePayment({ params, request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('workers.pay' as never)
    const payload = await request.validateUsing(workerPaymentValidator)
    try {
      await recordWorkerPayment({
        workerId: Number(params.id),
        amount: payload.amount,
        kind: payload.kind,
        periodStart: payload.periodStart ?? null,
        periodEnd: payload.periodEnd ?? null,
        note: payload.note ?? null,
        paidAt: payload.paidAt ?? undefined,
        actor: auth.user!,
      })
      session.flash('success', 'Payment recorded.')
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
