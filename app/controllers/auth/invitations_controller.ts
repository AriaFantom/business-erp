import type { HttpContext } from '@adonisjs/core/http'
import Invitation from '#models/invitation'
import User from '#models/user'
import { acceptInvitationValidator } from '#validators/invitation'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'

export default class InvitationController {
  /** GET /invite/:token */
  async show({ params, inertia, response }: HttpContext) {
    const invitation = await Invitation.query()
      .where('token', params.token)
      .where('status', 'pending')
      .where('expires_at', '>', DateTime.now().toSQL()!)
      .preload('role')
      .first()

    if (!invitation) {
      return response.redirect('/login?error=invalid_invitation')
    }

    return inertia.render('auth/invitation', {
      token: invitation.token,
      email: invitation.email,
      // The frontend reads this flag to disable the email field.
      // Server-side enforcement in store() is the real protection.
      emailLocked: invitation.email !== null,
      type: invitation.type,
      role: invitation.role.displayName,
    })
  }

  /** POST /invite/:token */
  async store({ params, request, response, session }: HttpContext) {
    const payload = await request.validateUsing(acceptInvitationValidator)

    const invitation = await Invitation.query()
      .where('token', params.token)
      .where('status', 'pending')
      .where('expires_at', '>', DateTime.now().toSQL()!)
      .first()

    if (!invitation) {
      session.flash('error', 'This invitation is no longer valid.')
      return response.redirect('/login')
    }

    // Resolve final email. For locked invitations, ignore client input.
    const finalEmail = invitation.email ?? payload.email

    if (!finalEmail) {
      session.flash('errors', { email: 'Email is required.' })
      return response.redirect().back()
    }

    // For locked invitations, refuse any attempt to override the email.
    if (
      invitation.email !== null &&
      payload.email !== undefined &&
      payload.email !== invitation.email
    ) {
      return response.badRequest({ message: 'Email cannot be changed.' })
    }

    // Avoid the noisier unique-constraint error.
    const existing = await User.findBy('email', finalEmail)
    if (existing) {
      session.flash('errors', { email: 'A user with this email already exists.' })
      return response.redirect().back()
    }

    await db.transaction(async (trx) => {
      const user = new User()
      user.useTransaction(trx)
      user.email = finalEmail
      user.password = payload.password // hashed by withAuthFinder mixin's beforeSave hook
      user.firstName = payload.firstName
      user.lastName = payload.lastName
      user.isOwner = invitation.type === 'setup'
      await user.save()

      await user.related('roles').attach([invitation.roleId])

      invitation.useTransaction(trx)
      invitation.status = 'accepted'
      invitation.acceptedAt = DateTime.now()
      await invitation.save()
    })

    session.flash('success', 'Account created. Please log in.')
    return response.redirect('/login')
  }
}
