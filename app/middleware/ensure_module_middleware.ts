import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { getEnabledModules } from '#services/modules/module_service'
import { getModule, type ModuleKey } from '#services/modules/registry'

/**
 * Blocks access to a module's routes when that module — or any of its hard
 * dependencies — is disabled for the install. GET (page) requests are redirected
 * to the dashboard with a flash; everything else gets a 404 so disabled APIs are
 * indistinguishable from non-existent ones.
 */
export default class EnsureModuleMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options: { module: ModuleKey }) {
    const def = getModule(options.module)
    const required: ModuleKey[] = def ? [def.key, ...def.dependsOn] : [options.module]

    const enabled = new Set(await getEnabledModules())
    const allowed = required.every((k) => enabled.has(k))

    if (!allowed) {
      if (ctx.request.method() === 'GET') {
        ctx.session?.flash('error', 'That module is currently disabled.')
        return ctx.response.redirect('/dashboard')
      }
      return ctx.response.notFound({ message: 'Module disabled' })
    }

    return next()
  }
}
