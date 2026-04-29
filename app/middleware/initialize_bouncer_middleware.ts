import { Bouncer } from '@adonisjs/bouncer'
import * as abilities from '#abilities/main'
import { policies } from '#generated/policies'
import { permissions } from '#start/permissions'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Merge hand-written abilities with the auto-generated ones from
 * permissions.abilities(). Computed once at import time and cached.
 */
const allAbilities = {
  ...abilities,
  ...permissions.abilities(),
}

export default class InitializeBouncerMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    ctx.bouncer = new Bouncer(
      () => ctx.auth.user || null,
      allAbilities,
      policies
    ).setContainerResolver(ctx.containerResolver)

    return next()
  }
}

declare module '@adonisjs/core/http' {
  export interface HttpContext {
    bouncer: Bouncer<
      Exclude<HttpContext['auth']['user'], undefined>,
      typeof allAbilities,
      typeof policies
    >
  }
}
