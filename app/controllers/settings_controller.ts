import type { HttpContext } from '@adonisjs/core/http'
import { updateModulesValidator } from '#validators/settings'
import {
  ModuleDependencyError,
  getEnabledModules,
  setEnabledModules,
} from '#services/modules/module_service'
import { MODULES, PRESETS } from '#services/modules/registry'

export default class SettingsController {
  /** Render the module enable/disable pipeline. */
  async showModules({ inertia, bouncer }: HttpContext) {
    await bouncer.authorize('settings.view' as never)
    const enabled = await getEnabledModules()
    return inertia.render('system/modules', {
      modules: MODULES,
      presets: PRESETS,
      enabled,
    })
  }

  /** Persist a new module selection. */
  async updateModules({ request, response, session, auth, bouncer }: HttpContext) {
    await bouncer.authorize('settings.manageModules' as never)
    const { enabledModules } = await request.validateUsing(updateModulesValidator)

    try {
      await setEnabledModules(enabledModules, auth.user!)
      session.flash('success', 'Module configuration updated.')
    } catch (error) {
      if (error instanceof ModuleDependencyError) {
        session.flash('error', error.message)
        return response.redirect().back()
      }
      throw error
    }

    return response.redirect().toRoute('settings.modules')
  }
}
