import type { HttpContext } from '@adonisjs/core/http'
import {
  getDashboardBranding,
  renameDashboard,
  replaceDashboardIcon,
  removeDashboardIcon,
  saveApplicationSettings,
} from '#services/dashboard_branding'
import { dashboardIconValidator, renameDashboardValidator } from '#validators/dashboard_branding'
import { updateApplicationSettingsValidator } from '#validators/dashboard_branding'
import { IMMUTABLE_PRIVATE, streamStoredObject } from '#services/file_streaming'
import { getAppCurrency, isSupportedCurrency, supportedCurrencyCodes } from '#services/currency'

export default class DashboardBrandingController {
  async show({ bouncer, inertia }: HttpContext) {
    await bouncer.authorize('isOwner' as never)
    const { name, iconUrl } = await getDashboardBranding()
    const currency = await getAppCurrency()
    return inertia.render('system/branding', {
      branding: { name, iconUrl },
      currency,
      currencyOptions: supportedCurrencyCodes(),
    } as never)
  }

  async update({ auth, bouncer, request, response, session }: HttpContext) {
    await bouncer.authorize('isOwner' as never)
    const payload = await request.validateUsing(updateApplicationSettingsValidator)
    if (!isSupportedCurrency(payload.currency)) {
      session.flash('errors', { currency: 'Choose a valid ISO currency.' })
      return response.redirect().back()
    }

    await saveApplicationSettings(auth.user!, payload)
    session.flash('success', 'Application settings updated.')
    return response.redirect().toPath('/system/settings')
  }

  async updateName({ auth, bouncer, request, response, session }: HttpContext) {
    await bouncer.authorize('isOwner' as never)
    const { name } = await request.validateUsing(renameDashboardValidator)
    await renameDashboard(auth.user!, name)
    session.flash('success', 'Dashboard name updated.')
    return response.redirect().toPath('/system/settings')
  }

  async icon({ response }: HttpContext) {
    const { iconKey } = await getDashboardBranding()
    if (!iconKey) return response.notFound({ error: 'File not found' })
    return streamStoredObject({ response }, iconKey, { cacheControl: IMMUTABLE_PRIVATE })
  }

  async updateIcon({ auth, bouncer, request, response, session }: HttpContext) {
    await bouncer.authorize('isOwner' as never)
    const { icon } = await request.validateUsing(dashboardIconValidator)
    await replaceDashboardIcon(auth.user!, icon)
    session.flash('success', 'Dashboard icon updated.')
    return response.redirect().toPath('/system/settings')
  }

  async destroyIcon({ auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('isOwner' as never)
    await removeDashboardIcon(auth.user!)
    session.flash('success', 'Dashboard icon removed.')
    return response.redirect().toPath('/system/settings')
  }
}
