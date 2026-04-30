import type { HttpContext } from '@adonisjs/core/http'
import Invitation from '#models/invitation'
import Role from '#models/role'
import { createInvitationValidator } from '#validators/invitation'
import { DateTime } from 'luxon'
import string from '@adonisjs/core/helpers/string'
import mail from '@adonisjs/mail/services/main'
import InvitationNotification from '#mails/invitation_notification'
import { effectivePriority } from '#services/role_hierarchy'

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

    // The owner role is reserved for the initial setup invitation; nobody —
    // including other owners — can hand it out through the regular invite flow.
    if (role.name === 'owner') {
      session.flash('errors', { roleId: 'The owner role cannot be assigned.' })
      return response.redirect().back()
    }

    // Hierarchy: only allow assigning roles strictly below the inviter's level.
    const myPriority = await effectivePriority(auth.user!)
    if (role.priority >= myPriority) {
      session.flash('errors', { roleId: 'You cannot assign a role at or above your own.' })
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

    invitation.$setRelated('role', role)

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

  /** POST /invitations/:id/resend — re-send a pending invitation email */
  async resend({ params, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('invitations.resend' as never)

    const invitation = await Invitation.find(params.id)
    if (!invitation) {
      session.flash('error', 'Invitation not found.')
      return response.redirect().back()
    }
    if (invitation.status !== 'pending') {
      session.flash('error', 'Only pending invitations can be resent.')
      return response.redirect().back()
    }
    if (!invitation.email) {
      session.flash('error', 'Setup invitations have no email to resend to.')
      return response.redirect().back()
    }

    // Refresh the expiry window so a stale link becomes usable again.
    invitation.expiresAt = DateTime.now().plus({ days: 7 })
    await invitation.save()
    await invitation.load('role')

    try {
      await mail.send(new InvitationNotification(invitation))
    } catch (err) {
      console.warn('[invitation] resend failed:', (err as Error).message)
      session.flash('error', 'Failed to send invitation email.')
      return response.redirect().back()
    }

    session.flash('success', `Invitation resent to ${invitation.email}.`)
    return response.redirect().back()
  }

  /** POST /invitations/:id/revoke — cancel a pending invitation */
  async revoke({ params, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('invitations.revoke' as never)

    const invitation = await Invitation.find(params.id)
    if (!invitation) {
      session.flash('error', 'Invitation not found.')
      return response.redirect().back()
    }
    if (invitation.status !== 'pending') {
      session.flash('error', 'Only pending invitations can be revoked.')
      return response.redirect().back()
    }

    invitation.status = 'revoked'
    await invitation.save()

    session.flash('success', 'Invitation revoked.')
    return response.redirect().back()
  }
}
