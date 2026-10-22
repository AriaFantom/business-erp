import type { HttpContext } from '@adonisjs/core/http'
import {
  getDashboardBranding,
  renameDashboard,
  replaceDashboardIcon,
  removeDashboardIcon,
} from '#services/dashboard_branding'
import { dashboardIconValidator, renameDashboardValidator } from '#validators/dashboard_branding'
import { IMMUTABLE_PRIVATE, streamStoredObject } from '#services/file_streaming'

export default class DashboardBrandingController {
  async show({ bouncer, inertia }: HttpContext) {
    await bouncer.authorize('isOwner' as never)
    const { name, iconUrl } = await getDashboardBranding()
    return inertia.render('system/branding', { branding: { name, iconUrl } })
  }

  async updateName({ auth, bouncer, request, response, session }: HttpContext) {
    await bouncer.authorize('isOwner' as never)
    const { name } = await request.validateUsing(renameDashboardValidator)
    await renameDashboard(auth.user!, name)
    session.flash('success', 'Dashboard name updated.')
    return response.redirect().toRoute('settings.branding')
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
    return response.redirect().toRoute('settings.branding')
  }

  async destroyIcon({ auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('isOwner' as never)
    await removeDashboardIcon(auth.user!)
    session.flash('success', 'Dashboard icon removed.')
    return response.redirect().toRoute('settings.branding')
  }
}
