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
import {
  findUserByEmail,
  legacyEmailAddress,
  normalizeEmailAddress,
} from '#services/email_addresses'
import { audit } from '#services/audit'
import { assignableRankedRoleIds, hasLivePermission, lockRoleOrder } from '#services/role_order'
import db from '@adonisjs/lucid/services/db'

class InvitationChangeError extends Error {}

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

    const payload = await request.validateUsing(createInvitationValidator)
    const email = normalizeEmailAddress(payload.email)
    const { roleId } = payload

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

    if (await findUserByEmail(email)) {
      session.flash('errors', { email: 'An account already exists for this email.' })
      return response.redirect().back()
    }

    // Include legacy addresses when checking older invitations.
    const legacy = await legacyEmailAddress(email)
    const existing = await Invitation.query()
      .whereRaw(
        'lower(email) in (' + (legacy ? '?, ?' : '?') + ')',
        legacy ? [email, legacy] : [email]
      )
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
    let invitation: Invitation
    try {
      invitation = await db.transaction(async (trx) => {
        await lockRoleOrder(trx)
        const assignableIds = await assignableRankedRoleIds(auth.user!, trx)
        if (
          !(await hasLivePermission(auth.user!, 'users.invite', trx)) ||
          !assignableIds.includes(roleId)
        ) {
          throw new InvitationChangeError('You can no longer invite someone into this role.')
        }
        if (await findUserByEmail(email, trx)) {
          throw new InvitationChangeError('An account already exists for this email.')
        }
        const duplicate = await Invitation.query({ client: trx })
          .whereRaw(
            'lower(email) in (' + (legacy ? '?, ?' : '?') + ')',
            legacy ? [email, legacy] : [email]
          )
          .where('status', 'pending')
          .where('expires_at', '>', DateTime.now().toSQL()!)
          .first()
        if (duplicate)
          throw new InvitationChangeError('A pending invitation already exists for this email.')
        const created = new Invitation()
        created.useTransaction(trx)
        created.merge({
          email,
          token: '',
          roleId,
          invitedBy: auth.user!.id,
          type: 'invite',
          status: 'pending',
          deliveryStatus: 'unknown',
          expiresAt: DateTime.now().plus({ days: 7 }),
        })
        await created.save()
        created.token = issueInvitationToken(created.id, 'invite', expiresIn)
        await created.save()
        await audit({
          actor: auth.user!,
          action: 'invitation.create',
          targetType: 'invitation',
          targetId: created.id,
          trx,
        })
        return created
      })
    } catch (error) {
      if (!(error instanceof InvitationChangeError)) throw error
      session.flash('error', error.message)
      return response.redirect().back()
    }

    invitation.$setRelated('role', role)

    try {
      await mail.send(new InvitationNotification(invitation))
      invitation.deliveryStatus = 'sent'
      invitation.sentAt = DateTime.now()
      await invitation.save()
    } catch (err) {
      console.warn('[invitation] mail send failed:', (err as Error).message)
      invitation.deliveryStatus = 'failed'
      await invitation.save()
      session.flash('error', `Could not send the invitation to ${email}. Use Retry in Invitations.`)
      return response.redirect().back()
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
      invitation.deliveryStatus = 'sent'
      invitation.sentAt = DateTime.now()
      await invitation.save()
    } catch (err) {
      console.warn('[invitation] resend failed:', (err as Error).message)
      invitation.deliveryStatus = 'failed'
      await invitation.save()
      session.flash('error', 'Failed to send invitation email. You can retry it.')
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
