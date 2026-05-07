import type { HttpContext } from '@adonisjs/core/http'

export default class RootController {
  /**
   * GET / — entry point.
   *
   * Sends the visitor to the right place based on auth state. The
   * `firstUserSetup` middleware runs ahead of this and intercepts when
   * there are zero users by redirecting to /invite/<token>.
   */
  async index({ auth, response }: HttpContext) {
    if (await auth.check()) {
      return response.redirect('/dashboard')
    }
    return response.redirect('/login')
  }
}
