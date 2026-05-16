import type { HttpContext } from '@adonisjs/core/http'
import Invitation from '#models/invitation'
import Role from '#models/role'
import { createInvitationValidator } from '#validators/invitation'
import { DateTime } from 'luxon'
import mail from '@adonisjs/mail/services/main'
import InvitationNotification from '#mails/invitation_notification'
import { canAssignRole } from '#services/role_hierarchy'
import { getInvitationsViewModel } from '#services/dashboard_view_models'
import { issueInvitationToken } from '#services/invitation_token'

export default class InvitationsController {
  /** GET /system/invitations — invite form + pending invitations */
  async index({ inertia, auth, bouncer }: HttpContext) {
    await bouncer.authorize('users.invite' as never)
    const data = await getInvitationsViewModel(auth.user!)
    return inertia.render('system/invitations', data)
  }

  /** POST /invitations — owner/admin invites a new user */
  async store({ request, auth, bouncer, response, session }: HttpContext) {
    await bouncer.authorize('users.invite' as never)

    const { email, roleId } = await request.validateUsing(createInvitationValidator)

    const role = await Role.find(roleId)
    if (!role) {
      session.flash('errors', { roleId: 'Role not found.' })
      return response.redirect().back()
    }

    if (!(await canAssignRole(auth.user!, role))) {
      session.flash('errors', {
        roleId: 'You cannot assign this role — it is at or above your own level.',
      })
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

    const expiresIn = '7 days'
    const invitation = await Invitation.create({
      email,
      // Filled in below once we know the row id.
      token: '',
      roleId,
      invitedBy: auth.user!.id,
      type: 'invite',
      status: 'pending',
      expiresAt: DateTime.now().plus({ days: 7 }),
    })

    // Encryption needs the row id so the link is bound to this specific
    // invitation. Issue the token, then persist it.
    invitation.token = issueInvitationToken(invitation.id, 'invite', expiresIn)
    await invitation.save()

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
    // The encrypted token also carries an expiry, so re-issue it.
    const purpose = invitation.type === 'setup' ? 'setup' : 'invite'
    invitation.expiresAt = DateTime.now().plus({ days: 7 })
    invitation.token = issueInvitationToken(invitation.id, purpose, '7 days')
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
