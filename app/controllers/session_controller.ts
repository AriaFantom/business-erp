import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'
import { findUserByEmail, normalizeEmailAddress } from '#services/email_addresses'

export default class SessionController {
  async create({ inertia }: HttpContext) {
    return inertia.render('auth/login', {})
  }

  async store({ request, auth, response, session }: HttpContext) {
    const { email, password } = request.all()
    const address = normalizeEmailAddress(email)
    const account = await findUserByEmail(address)
    const user = await User.verifyCredentials(account?.email ?? address, password)

    if (!user.isActive) {
      session.flash('error', 'This account has been revoked.')
      return response.redirect().back()
    }

    await auth.use('web').login(user)
    response.redirect('/dashboard')
  }

  async destroy({ auth, response }: HttpContext) {
    await auth.use('web').logout()
    response.redirect().toRoute('session.create')
  }
}
