import type { HttpContext } from '@adonisjs/core/http'
import Invitation from '#models/invitation'
import Role from '#models/role'
import { createInvitationValidator } from '#validators/invitation'
import { DateTime } from 'luxon'
import string from '@adonisjs/core/helpers/string'
import mail from '@adonisjs/mail/services/main'
import InvitationNotification from '#mails/invitation_notification'

export default class InvitationsController {
  /** POST /invitations — owner/admin invites a new user */
  async store({ request, auth, bouncer, response, session }: HttpContext) {
    // RBAC check: needs the users.invite permission.
    // The ability is auto-generated from start/permissions.ts.
    await bouncer.authorize('users.invite' as never)

    const { email, roleId } = await request.validateUsing(createInvitationValidator)

    // Refuse to invite somebody who already has an account.
    const role = await Role.find(roleId)
    if (!role) {
      session.flash('errors', { roleId: 'Role not found.' })
      return response.redirect().back()
    }

    // Refuse duplicate pending invitations to the same email.
    const existing = await Invitation.query()
      .where('email', email)
      .where('status', 'pending')
      .where('expires_at', '>', DateTime.now().toSQL()!)
      .first()

    if (existing) {
      session.flash('errors', {
        email: 'A pending invitation already exists for this email.',
      })
      return response.redirect().back()
    }

    const invitation = await Invitation.create({
      email,
      token: string.random(64),
      roleId,
      invitedBy: auth.user!.id,
      type: 'invite',
      status: 'pending',
      expiresAt: DateTime.now().plus({ days: 7 }),
    })

    // Best-effort send. In dev with no SMTP configured, this will just
    // log to the console.
    try {
      await mail.send(new InvitationNotification(invitation))
    } catch (err) {
      console.warn('[invitation] mail send failed:', (err as Error).message)
    }

    session.flash('success', `Invitation sent to ${email}.`)
    return response.redirect().back()
  }
}
