import type { HttpContext } from '@adonisjs/core/http'
import Invitation from '#models/invitation'
import User from '#models/user'
import { acceptInvitationValidator } from '#validators/invitation'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import { verifyInvitationToken, type InvitationPurpose } from '#services/invitation_token'
import { findUserByEmail, normalizeEmailAddress } from '#services/email_addresses'
import { audit } from '#services/audit'
import { lockRoleOrder } from '#services/role_order'

class AcceptanceError extends Error {}

async function resolveInvitation(token: string) {
  // The same URL has to handle both setup and invite tokens, so try both
  // purposes. Decryption only succeeds for the purpose the token was
  // issued for, so this never crosses the streams.
  const purposes: InvitationPurpose[] = ['invite', 'setup']
  for (const purpose of purposes) {
    const id = verifyInvitationToken(token, purpose)
    if (id === null) continue
    const invitation = await Invitation.query()
      .where('id', id)
      .where('token', token)
      .where('type', purpose)
      .where('status', 'pending')
      .where('expires_at', '>', DateTime.now().toSQL()!)
      .preload('role')
      .first()
    if (invitation) return invitation
  }
  return null
}

export default class InvitationController {
  /** GET /invite/:token */
  async show({ params, inertia, response }: HttpContext) {
    const invitation = await resolveInvitation(params.token)

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
    const purpose = (['invite', 'setup'] as InvitationPurpose[]).find(
      (candidate) => verifyInvitationToken(params.token, candidate) !== null
    )
    const invitationId = purpose ? verifyInvitationToken(params.token, purpose) : null
    if (!purpose || invitationId === null) {
      session.flash('error', 'This invitation is no longer valid.')
      return response.redirect('/login')
    }

    try {
      await db.transaction(async (trx) => {
        await lockRoleOrder(trx)
        const invitation = await Invitation.query({ client: trx })
          .where('id', invitationId)
          .forUpdate()
          .first()
        if (
          !invitation ||
          invitation.token !== params.token ||
          invitation.type !== purpose ||
          invitation.status !== 'pending' ||
          invitation.expiresAt.toMillis() <= DateTime.now().toMillis()
        ) {
          throw new AcceptanceError('This invitation is no longer valid.')
        }

        const finalEmail = invitation.email ?? payload.email
        if (!finalEmail) throw new AcceptanceError('Email is required.')
        const address = normalizeEmailAddress(finalEmail)
        if (
          invitation.email !== null &&
          payload.email !== undefined &&
          normalizeEmailAddress(payload.email) !== address
        ) {
          throw new AcceptanceError('Email cannot be changed.')
        }
        // Different invitation rows for the same address cannot create accounts concurrently.
        await trx.rawQuery('SELECT pg_advisory_xact_lock(179001, hashtext(?))', [address])
        if (await findUserByEmail(address, trx)) {
          throw new AcceptanceError('An account with this email already exists.')
        }

        const user = new User()
        user.useTransaction(trx)
        user.email = address
        user.password = payload.password
        user.firstName = payload.firstName
        user.lastName = payload.lastName
        user.isOwner = invitation.type === 'setup'
        await user.save()
        await user.related('roles').attach([invitation.roleId])

        invitation.useTransaction(trx)
        invitation.status = 'accepted'
        invitation.acceptedAt = DateTime.now()
        await invitation.save()
        await audit({
          actor: user,
          action: 'invitation.accept',
          targetType: 'invitation',
          targetId: invitation.id,
          trx,
        })
      })
    } catch (error) {
      if (error instanceof AcceptanceError || (error as { code?: string }).code === '23505') {
        session.flash(
          'error',
          error instanceof AcceptanceError
            ? error.message
            : 'An account with this email already exists.'
        )
        return response.redirect().back()
      }
      throw error
    }

    session.flash('success', 'Account created. Please log in.')
    return response.redirect('/login')
  }
}
