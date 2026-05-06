import type { HttpContext } from '@adonisjs/core/http'
import {
  addExpenseValidator,
  completeJobValidator,
  consumeMaterialValidator,
  createJobValidator,
  failJobValidator,
} from '#validators/jobs'
import { getJobShowViewModel, getJobsIndexViewModel } from '#services/jobs_view_models'
import {
  cancelJob,
  completeJob,
  createJob,
  failJob,
  recordConsumption,
  recordExpense,
  startJob,
} from '#services/job_costing'
import { DomainError } from '#services/domain_errors'

export default class JobsController {
  async index({ request, inertia, bouncer }: HttpContext) {
    await bouncer.authorize('jobs.view' as never)
    const qs = request.qs()
    const data = await getJobsIndexViewModel({
      q: typeof qs.q === 'string' ? qs.q : undefined,
      status: typeof qs.status === 'string' ? qs.status : undefined,
      productId: qs.productId ? Number(qs.productId) : undefined,
    })
    return inertia.render('jobs/index', {
      ...data,
      filters: {
        q: typeof qs.q === 'string' ? qs.q : '',
        status: typeof qs.status === 'string' ? qs.status : 'all',
        productId: qs.productId ? String(qs.productId) : 'all',
      },
    })
  }

  async show({ params, inertia, bouncer }: HttpContext) {
    await bouncer.authorize('jobs.view' as never)
    const data = await getJobShowViewModel(Number(params.id))
    return inertia.render('jobs/show', data)
  }

  async store({ request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('jobs.create' as never)
    const payload = await request.validateUsing(createJobValidator)
    try {
      const job = await createJob({
        productId: payload.productId,
        plannedQty: payload.plannedQty,
        parentJobId: payload.parentJobId ?? null,
        note: payload.note ?? null,
        actor: auth.user!,
      })
      session.flash('success', `Job ${job.number} created.`)
      return response.redirect().toPath(`/jobs/${job.id}`)
    } catch (err) {
      return this._domain(err, response, session)
    }
  }

  async start({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('jobs.create' as never)
    try {
      await startJob(Number(params.id), auth.user!)
      session.flash('success', 'Job started.')
    } catch (err) {
      return this._domain(err, response, session)
    }
    return response.redirect().back()
  }

  async consume({ params, request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('jobs.consumeMaterial' as never)
    const payload = await request.validateUsing(consumeMaterialValidator)
    try {
      await recordConsumption({
        jobId: Number(params.id),
        itemKind: payload.itemKind,
        itemId: payload.itemId,
        qtyConsumed: payload.qtyConsumed,
        qtyWasted: payload.qtyWasted,
        reason: payload.reason,
        actor: auth.user!,
      })
      session.flash('success', 'Consumption recorded.')
    } catch (err) {
      return this._domain(err, response, session)
    }
    return response.redirect().back()
  }

  async addExpense({ params, request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('jobs.addExpense' as never)
    const payload = await request.validateUsing(addExpenseValidator)
    try {
      await recordExpense({
        jobId: Number(params.id),
        kind: payload.kind,
        description: payload.description,
        amount: payload.amount,
        incurredAt: payload.incurredAt ?? undefined,
        actor: auth.user!,
      })
      session.flash('success', 'Expense added.')
    } catch (err) {
      return this._domain(err, response, session)
    }
    return response.redirect().back()
  }

  async complete({ params, request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('jobs.complete' as never)
    const payload = await request.validateUsing(completeJobValidator)
    try {
      await completeJob({
        jobId: Number(params.id),
        producedQty: payload.producedQty,
        actor: auth.user!,
      })
      session.flash('success', 'Job completed.')
    } catch (err) {
      return this._domain(err, response, session)
    }
    return response.redirect().back()
  }

  async fail({ params, request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('jobs.complete' as never)
    const payload = await request.validateUsing(failJobValidator)
    try {
      await failJob({
        jobId: Number(params.id),
        reason: payload.reason ?? null,
        actor: auth.user!,
      })
      session.flash('success', 'Job marked as failed.')
    } catch (err) {
      return this._domain(err, response, session)
    }
    return response.redirect().back()
  }

  async cancel({ params, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('jobs.cancel' as never)
    try {
      await cancelJob(Number(params.id), auth.user!)
      session.flash('success', 'Job cancelled.')
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
