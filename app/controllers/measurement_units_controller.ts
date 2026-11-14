import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import {
  createMeasurementUnit,
  getMeasurementUnits,
  updateMeasurementUnit,
} from '#services/measurement_registry'
import { DomainError } from '#services/domain_errors'

const factorRule = () =>
  vine
    .string()
    .trim()
    .regex(/^(?!0+(?:\.0+)?$)\d{1,12}(?:\.\d{1,12})?$/)
const nameRule = () => vine.string().trim().minLength(1).maxLength(80)
const createValidator = vine.compile(
  vine.object({
    name: nameRule(),
    code: vine
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9_-]{0,15}$/),
    factor: factorRule(),
    categoryId: vine.number().positive().withoutDecimals().optional(),
    categoryName: nameRule().optional(),
  })
)
const updateValidator = vine.compile(
  vine.object({
    name: nameRule(),
    active: vine.boolean(),
    factor: factorRule().optional(),
  })
)
const unitsPath = '/system/settings/units'

export default class MeasurementUnitsController {
  async index({ bouncer, inertia }: HttpContext) {
    await bouncer.authorize('isOwner' as never)
    return inertia.render('system/units' as never, { units: await getMeasurementUnits() } as never)
  }

  async store({ bouncer, auth, request, response, session }: HttpContext) {
    await bouncer.authorize('isOwner' as never)
    const payload = await request.validateUsing(createValidator)
    try {
      await createMeasurementUnit(auth.user!, payload)
      session.flash('success', 'Unit created.')
    } catch (error) {
      if (!(error instanceof DomainError)) throw error
      session.flash('error', error.message)
    }
    return response.redirect().toPath(unitsPath)
  }

  async update({ bouncer, auth, params, request, response, session }: HttpContext) {
    await bouncer.authorize('isOwner' as never)
    const payload = await request.validateUsing(updateValidator)
    try {
      await updateMeasurementUnit(auth.user!, Number(params.id), payload)
      session.flash('success', 'Unit updated.')
    } catch (error) {
      if (!(error instanceof DomainError)) throw error
      session.flash('error', error.message)
    }
    return response.redirect().toPath(unitsPath)
  }
}
