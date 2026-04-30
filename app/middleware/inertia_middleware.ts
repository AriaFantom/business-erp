import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type User from '#models/user'
import BaseInertiaMiddleware from '@adonisjs/inertia/inertia_middleware'
import { effectivePriority } from '#services/role_hierarchy'

// Sentinel used on the wire for owners (effectivePriority returns +Infinity,
// which doesn't survive JSON.stringify).
export const OWNER_PRIORITY = Number.MAX_SAFE_INTEGER

async function serializeUser(user: User) {
  // Owners implicitly hold every active permission; everyone else gets
  // the union of permissions across their assigned roles.
  const userPermissions = user.isOwner ? ['*'] : await user.getPermissions()
  const priority = user.isOwner ? OWNER_PRIORITY : await effectivePriority(user)
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    isOwner: user.isOwner,
    permissions: userPermissions,
    priority,
  }
}

export default class InertiaMiddleware extends BaseInertiaMiddleware {
  async share(ctx: HttpContext) {
    /**
     * The share method is called everytime an Inertia page is rendered. In
     * certain cases, a page may get rendered before the session middleware
     * or the auth middleware are executed. For example: During a 404 request.
     *
     * In that case, we must always assume that HttpContext is not fully hydrated
     * with all the properties
     */
    const { session, auth } = ctx as Partial<HttpContext>

    /**
     * Fetching the first error from the flash messages
     */
    const error = session?.flashMessages.get('error') as string
    const success = session?.flashMessages.get('success') as string

    const user = auth?.user ? await serializeUser(auth.user) : undefined

    /**
     * Data shared with all Inertia pages. Make sure you are using
     * transformers for rich data-types like Models.
     */
    return {
      errors: ctx.inertia.always(this.getValidationErrors(ctx)),
      flash: ctx.inertia.always({
        error,
        success,
      }),
      user: ctx.inertia.always(user),
    }
  }

  async handle(ctx: HttpContext, next: NextFn) {
    await this.init(ctx)

    const output = await next()
    this.dispose(ctx)

    return output
  }
}

declare module '@adonisjs/inertia/types' {
  type MiddlewareSharedProps = InferSharedProps<InertiaMiddleware>
  export interface SharedProps extends MiddlewareSharedProps {}
}
