import type { HttpContext } from '@adonisjs/core/http'

export default class DashboardController {
  /**
   * GET /dashboard — landing page after login.
   *
   * Intentionally empty for now; rich dashboard content is being designed
   * separately. The page renders inside DashboardLayout (with the sidebar)
   * via Inertia's persistent-layout pattern.
   */
  async index({ inertia }: HttpContext) {
    return inertia.render('dashboard', {})
  }
}
