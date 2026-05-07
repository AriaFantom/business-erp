import encryption from '@adonisjs/core/services/encryption'

/**
 * Purpose-bound, expiring tokens for invitation links.
 *
 * The token is an AdonisJS-encrypted blob carrying the invitation id, scoped
 * to a `purpose` and stamped with a server-side TTL. A token issued for one
 * purpose (e.g. accepting an invite) cannot be replayed for another (e.g.
 * password reset) because decryption requires the matching purpose string.
 *
 * The token is also stored on the invitation row so we can list/revoke
 * pending invitations and re-send the same link without re-issuing it.
 */

export type InvitationPurpose = 'invite' | 'setup'

const PURPOSE_PREFIX = 'invitations:'

function purposeKey(p: InvitationPurpose) {
  return `${PURPOSE_PREFIX}${p}`
}

export function issueInvitationToken(
  invitationId: number,
  purpose: InvitationPurpose,
  expiresIn: string
): string {
  return encryption.encrypt({ id: invitationId }, expiresIn, purposeKey(purpose))
}

/**
 * Returns the invitation id encoded inside the token, or null when the token
 * is malformed, expired, or was issued for a different purpose.
 */
export function verifyInvitationToken(token: string, purpose: InvitationPurpose): number | null {
  const payload = encryption.decrypt<{ id: number } | null>(token, purposeKey(purpose))
  if (!payload || typeof payload.id !== 'number') return null
  return payload.id
}
