import vine from '@vinejs/vine'
import User from '#models/user'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

// Case handling is consistent across invitations and login, while the local
// part (including dots and tags) remains the address the person supplied.
export function normalizeEmailAddress(value: string): string {
  return value.trim().toLowerCase()
}

const oldEmailValidator = vine.compile(
  vine.object({ email: vine.string().email().normalizeEmail() })
)

/** The previous invitation validator collapsed provider-specific aliases. */
export async function legacyEmailAddress(value: string): Promise<string | null> {
  const address = normalizeEmailAddress(value)
  const parsed = await oldEmailValidator.validate({ email: address })
  return parsed.email === address ? null : parsed.email
}

/** Exact address wins; only a missing exact account can use legacy matching. */
export async function findUserByEmail(
  value: string,
  trx?: TransactionClientContract
): Promise<User | null> {
  const address = normalizeEmailAddress(value)
  const exact = await User.query({ client: trx }).whereRaw('lower(email) = ?', [address]).first()
  if (exact) return exact
  const legacy = await legacyEmailAddress(address)
  return legacy ? User.query({ client: trx }).whereRaw('lower(email) = ?', [legacy]).first() : null
}
